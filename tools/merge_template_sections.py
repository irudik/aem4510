#!/usr/bin/env python3
"""Update shared root-document sections while retaining project sections.

Root `AGENTS.md` and `CLAUDE.md` combine template instructions with project
facts. This command replaces only the named template sections, inserts missing
template sections in their source order, and removes the retired replication
instructions. Every other target section remains byte-for-byte unchanged.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

try:
    from sync_template import (
        DepartureRule,
        PathReason,
        TEMPLATE_ROOT,
        current_branch,
        load_departures,
        matching_departures,
    )
except ModuleNotFoundError:
    from tools.sync_template import (  # type: ignore[no-redef]
        DepartureRule,
        PathReason,
        TEMPLATE_ROOT,
        current_branch,
        load_departures,
        matching_departures,
    )


SHARED_SECTION_TITLES = (
    "Core Principles",
    "Quality Thresholds",
    "Skills Quick Reference",
    "Shared Skill Protocols",
)

AGENTS_SECTION_TITLES = SHARED_SECTION_TITLES + (
    "Risk-Based Workflow",
    "Refactoring Protocol",
    "Solver Debugging Protocol",
    "Diagnosis",
    "Proposed Fix",
    "General Trace Protocol",
    "Output Verification Formats",
    "Routine Code Verification",
    "Planning Workflow",
    "Quality Gates & Scoring Rubrics",
    "Task Completion Verification Protocol",
    "Session Logging",
    "Structured Handoffs",
    "Structured Learning",
    "Command Conventions",
    "Workflow Quick Reference",
)

CLAUDE_SECTION_TITLES = SHARED_SECTION_TITLES + (
    "Claude Loading Model",
    "Claude-Specific Notes",
    "Kimi Code CLI",
    "Explicit Codex Handoff",
    "Plan-First Notes",
)

OWNED_SECTION_TITLES = {
    "AGENTS.md": AGENTS_SECTION_TITLES,
    "CLAUDE.md": CLAUDE_SECTION_TITLES,
}

# Commands combines shared path instructions with each project's own command
# list. Folder Structure and Current Project State contain only project facts,
# so Commands is the only project-owned section with a shared prose prefix.
SHARED_PREAMBLE_SECTION_TITLES = {
    "AGENTS.md": ("Commands",),
    "CLAUDE.md": ("Commands",),
}

RETIRED_FIRST_TITLE = "Replication-First Protocol"
RETIRED_FOLLOWING_TITLES = {
    "Replication Targets: [Paper Author (Year)]",
    "Summary",
    "Results Comparison",
    "Discrepancies",
    "Discrepancies (if any)",
    "Environment",
}

SECTION_HEADING = re.compile(br"(?m)^## ([^\r\n]+)(?:\r?\n|$)")
ANY_HEADING = re.compile(br"(?m)^(#{2,}) ([^\r\n]+)(?:\r?\n|$)")
SINGLE_SOURCE_BULLET = re.compile(
    br"(?m)^- \*\*Single source of truth\*\*[^\r\n]*"
    br"(?:\r?\n[ \t]+[^\r\n]*)*(?:\r?\n|$)"
)
FENCED_BLOCK = re.compile(br"(?m)^```[^\r\n]*(?:\r?\n|$)")


@dataclass(frozen=True)
class DocumentSection:
    """One `##` section, including its heading and trailing separator."""

    title: str
    contents: bytes


@dataclass
class MergeReport:
    """Section changes for one repository."""

    repository: str
    branch: str
    mode: str
    updated: list[str] = field(default_factory=list)
    inserted_sections: list[str] = field(default_factory=list)
    replaced_sections: list[str] = field(default_factory=list)
    removed_sections: list[str] = field(default_factory=list)
    departures_honored: list[PathReason] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def has_changes(self) -> bool:
        """Return whether either root instruction file would change."""

        return bool(self.updated)

    def as_dictionary(self) -> dict[str, object]:
        """Return plain values suitable for a JSON report."""

        return asdict(self)


def parse_sections(contents: bytes) -> tuple[bytes, list[DocumentSection]]:
    """Split a Markdown document on every column-one `##` heading."""

    matches = list(SECTION_HEADING.finditer(contents))
    if not matches:
        return contents, []

    preamble = contents[: matches[0].start()]
    sections: list[DocumentSection] = []
    for position, match in enumerate(matches):
        end = matches[position + 1].start() if position + 1 < len(matches) else len(contents)
        title = match.group(1).decode("utf-8")
        sections.append(DocumentSection(title=title, contents=contents[match.start() : end]))
    return preamble, sections


def require_unique_sections(path: Path, sections: list[DocumentSection]) -> None:
    """Reject repeated `##` titles because their ownership would be unclear."""

    seen: set[str] = set()
    repeated: set[str] = set()
    for section in sections:
        if section.title in seen:
            repeated.add(section.title)
        seen.add(section.title)
    if repeated:
        names = ", ".join(sorted(repeated))
        raise ValueError(f"{path} repeats section titles: {names}")


def source_sections(
    template_path: Path,
    owned_titles: tuple[str, ...],
) -> tuple[dict[str, DocumentSection], dict[str, int]]:
    """Read required source sections and their positions in the template."""

    _, sections = parse_sections(template_path.read_bytes())
    require_unique_sections(template_path, sections)
    by_title = {section.title: section for section in sections}
    missing = [title for title in owned_titles if title not in by_title]
    if missing:
        raise ValueError(
            f"{template_path} is missing required sections: {', '.join(missing)}"
        )
    ranks = {section.title: position for position, section in enumerate(sections)}
    return by_title, ranks


def headings_in_removed_section(section: DocumentSection) -> list[str]:
    """List every heading removed with a retired instruction section."""

    return [
        f"{'#' * len(match.group(1))} {match.group(2).decode('utf-8')}"
        for match in ANY_HEADING.finditer(section.contents)
    ]


def remove_retired_sections(
    sections: list[DocumentSection],
) -> tuple[list[DocumentSection], list[str]]:
    """Remove the retired replication section and only its named continuations."""

    retained: list[DocumentSection] = []
    removed: list[str] = []
    removing_replication = False

    for section in sections:
        if section.title == RETIRED_FIRST_TITLE:
            removing_replication = True
            removed.extend(headings_in_removed_section(section))
            continue
        if removing_replication and section.title in RETIRED_FOLLOWING_TITLES:
            removed.extend(headings_in_removed_section(section))
            continue
        removing_replication = False
        retained.append(section)

    return retained, removed


def restore_single_source_bullet(
    source_section: DocumentSection,
    target_section: DocumentSection | None,
) -> DocumentSection:
    """Keep the target's own manuscript location inside Core Principles."""

    if target_section is None:
        return source_section
    target_match = SINGLE_SOURCE_BULLET.search(target_section.contents)
    source_match = SINGLE_SOURCE_BULLET.search(source_section.contents)
    if target_match is None or source_match is None:
        return source_section
    contents = (
        source_section.contents[: source_match.start()]
        + target_match.group(0)
        + source_section.contents[source_match.end() :]
    )
    return DocumentSection(title=source_section.title, contents=contents)


def merge_shared_preamble(
    source_section: DocumentSection,
    target_section: DocumentSection,
) -> DocumentSection:
    """Combine shared opening prose with a project's first fenced block onward."""

    source_fence = FENCED_BLOCK.search(source_section.contents)
    target_fence = FENCED_BLOCK.search(target_section.contents)
    if source_fence is None or target_fence is None:
        raise ValueError(
            f"Section {target_section.title!r} must contain a fenced command block"
        )
    contents = (
        source_section.contents[: source_fence.start()]
        + target_section.contents[target_fence.start() :]
    )
    return DocumentSection(title=target_section.title, contents=contents)


def merge_document_contents(
    template_path: Path,
    target_path: Path,
    owned_titles: tuple[str, ...],
) -> tuple[bytes, list[str], list[str], list[str]]:
    """Return merged bytes and the inserted, replaced, and removed sections."""

    source_by_title, source_ranks = source_sections(template_path, owned_titles)
    target_contents = target_path.read_bytes()
    preamble, target_sections = parse_sections(target_contents)
    require_unique_sections(target_path, target_sections)
    target_sections, removed = remove_retired_sections(target_sections)
    target_by_title = {section.title: section for section in target_sections}
    shared_preamble_titles = SHARED_PREAMBLE_SECTION_TITLES.get(
        target_path.name,
        (),
    )
    for title in shared_preamble_titles:
        if title not in source_by_title or title not in target_by_title:
            raise ValueError(
                f"{target_path} must contain the shared-preamble section {title!r}"
            )

    core_source = source_by_title["Core Principles"]
    source_by_title["Core Principles"] = restore_single_source_bullet(
        core_source,
        target_by_title.get("Core Principles"),
    )

    missing_titles = {title for title in owned_titles if title not in target_by_title}
    inserted: list[str] = []
    replaced: list[str] = []
    output_sections: list[DocumentSection] = []
    last_known_rank = -1

    for target_section in target_sections:
        target_rank = source_ranks.get(target_section.title)
        if target_rank is not None:
            if target_rank < last_known_rank:
                raise ValueError(
                    f"{target_path} has template sections outside template order near "
                    f"{target_section.title!r}"
                )
            for title in owned_titles:
                if title in missing_titles and source_ranks[title] < target_rank:
                    output_sections.append(source_by_title[title])
                    inserted.append(title)
                    missing_titles.remove(title)
            last_known_rank = target_rank

        if target_section.title in shared_preamble_titles:
            merged_section = merge_shared_preamble(
                source_by_title[target_section.title],
                target_section,
            )
            output_sections.append(merged_section)
            if merged_section.contents != target_section.contents:
                replaced.append(target_section.title)
        elif target_section.title in owned_titles:
            output_sections.append(source_by_title[target_section.title])
            if source_by_title[target_section.title].contents != target_section.contents:
                replaced.append(target_section.title)
        else:
            output_sections.append(target_section)

    for title in owned_titles:
        if title in missing_titles:
            output_sections.append(source_by_title[title])
            inserted.append(title)
            missing_titles.remove(title)

    merged = preamble + b"".join(section.contents for section in output_sections)
    return merged, inserted, replaced, removed


def merge_repository(
    template_root: Path,
    repository: Path,
    *,
    apply: bool,
) -> MergeReport:
    """Merge root instruction sections in one checked-out repository."""

    template_root = template_root.resolve()
    repository = repository.resolve()
    if template_root == repository:
        raise ValueError("The target repository must differ from the template")
    if not repository.is_dir():
        raise FileNotFoundError(f"Target repository is missing: {repository}")

    departures = load_departures(repository)
    report = MergeReport(
        repository=str(repository),
        branch=current_branch(repository),
        mode="apply" if apply else "dry-run",
    )

    for file_name, owned_titles in OWNED_SECTION_TITLES.items():
        matches = matching_departures(file_name, departures)
        if matches:
            for _, departure in matches:
                report.departures_honored.append(
                    PathReason(path=file_name, reason=departure.reason)
                )
            continue

        template_path = template_root / file_name
        target_path = repository / file_name
        if not template_path.is_file():
            raise FileNotFoundError(f"Template file is missing: {template_path}")
        if not target_path.is_file() or target_path.is_symlink():
            raise FileNotFoundError(
                f"Target hybrid file must already exist as a regular file: {target_path}"
            )

        merged, inserted, replaced, removed = merge_document_contents(
            template_path,
            target_path,
            owned_titles,
        )
        original = target_path.read_bytes()
        if merged == original:
            continue

        report.updated.append(file_name)
        report.inserted_sections.extend(f"{file_name}: {title}" for title in inserted)
        report.replaced_sections.extend(f"{file_name}: {title}" for title in replaced)
        report.removed_sections.extend(f"{file_name}: {title}" for title in removed)
        if apply:
            target_path.write_bytes(merged)

    report.updated.sort()
    report.inserted_sections.sort()
    report.replaced_sections.sort()
    report.removed_sections.sort()
    report.departures_honored.sort(key=lambda item: (item.path, item.reason))
    return report


def print_list(title: str, items: list[str]) -> None:
    """Print one section-change category."""

    print(f"{title} ({len(items)}):")
    for item in items:
        print(f"  {item}")


def print_report(report: MergeReport) -> None:
    """Print one repository's merge result."""

    print(f"Repository: {report.repository}")
    print(f"Branch: {report.branch}")
    print(f"Mode: {report.mode}")
    print_list("Updated files", report.updated)
    print_list("Inserted template sections", report.inserted_sections)
    print_list("Replaced template sections", report.replaced_sections)
    print_list("Removed retired headings", report.removed_sections)
    print(f"Departures honored ({len(report.departures_honored)}):")
    for item in report.departures_honored:
        print(f"  {item.path}: {item.reason}")
    print_list("Warnings", report.warnings)


def write_json_report(report_path: Path, reports: list[MergeReport]) -> None:
    """Write all merge results to one machine-readable report."""

    report_path = report_path.resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps([report.as_dictionary() for report in reports], indent=2)
        + "\n"
    )


def parse_arguments(arguments: list[str] | None = None) -> argparse.Namespace:
    """Read command-line arguments for one or more target repositories."""

    parser = argparse.ArgumentParser(
        description="Merge shared sections in root AGENTS.md and CLAUDE.md."
    )
    parser.add_argument(
        "--repo",
        action="append",
        required=True,
        type=Path,
        help="Target repository path; repeat for more than one repository.",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes. Without this flag, the command is a dry run.",
    )
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Report changes without applying them; this is the default.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional path for a JSON report covering every target.",
    )
    return parser.parse_args(arguments)


def main(arguments: list[str] | None = None) -> int:
    """Merge every requested repository and print separate summaries."""

    parsed = parse_arguments(arguments)
    reports: list[MergeReport] = []
    try:
        for position, repository in enumerate(parsed.repo):
            if position:
                print()
            report = merge_repository(
                TEMPLATE_ROOT,
                repository,
                apply=parsed.apply,
            )
            reports.append(report)
            print_report(report)
        if parsed.report is not None:
            write_json_report(parsed.report, reports)
    except (FileNotFoundError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Template section merge failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
