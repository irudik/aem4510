#!/usr/bin/env python3
"""Copy the shared research framework without disturbing project work.

The template and each research repository share a bounded set of instruction,
permission, and review files. This command copies only that set, removes only
named retired files, and records each proposed or completed change. A dry run
is the default so a repository can be reviewed before any file or Git index
entry changes.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import stat
import subprocess
import sys
import tomllib
from dataclasses import asdict, dataclass, field
from pathlib import Path, PurePosixPath
from typing import Iterable


TEMPLATE_ROOT = Path(__file__).resolve().parents[1]

COPY_PREFIXES = (
    ".agents/",
    ".claude/agents/",
    ".claude/hooks/",
    ".claude/skills/",
    ".codex/",
    ".kimi-code/",
    "protocols/",
    "templates/",
    "tools/",
    ".github/",
)

COPY_EXACT_PATHS = {
    ".claude/settings.json.example",
    ".lintr",
    "AGENTS.md",
    "code/AGENTS.md",
    "code/CLAUDE.md",
    "latex/AGENTS.md",
    "latex/CLAUDE.md",
}

COPY_EXCLUDED_PATHS = {
    "AGENTS.md",
    "tools/template_departures.toml",
    "tools/template_check.toml",
}

# These files are part of the current template update but cannot be tracked
# until the requested review is complete. Listing them here lets this run copy
# the finished tools before any commit is made. Once tracked, this list has no
# effect on discovery.
CURRENT_UPDATE_PATHS = (
    "tools/sync_template.py",
    "tools/merge_template_sections.py",
    "tools/tests/test_template_check.py",
    "tools/tests/test_sync_template.py",
    "tools/tests/test_merge_template_sections.py",
)

RETIRED_TREE_PATHS = (
    ".claude/rules",
    ".codex/hooks",
)

RETIRED_FILE_PATHS = (
    ".claude/hooks/log-reminder.py",
    ".claude/WORKFLOW_QUICK_REF.md",
    ".claude/agents/verifier.md",
    ".claude/.headroom_wrap_marker.json",
    ".codex/hooks.json",
)

REMOVE_WHEN_EMPTY_PATHS = (".codex/agents",)

UNTRACK_ONLY_PATHS = (".claude/settings.json",)

NEVER_TOUCH_TOP_LEVEL = {
    "data",
    "output",
    "quality_reports",
}

NEVER_TOUCH_ROOT_FILES = {
    "MEMORY.md",
    "README.md",
    "Makefile",
}

ALLOWED_CODE_AND_LATEX_PATHS = {
    "code/AGENTS.md",
    "code/CLAUDE.md",
    "latex/AGENTS.md",
    "latex/CLAUDE.md",
}

README_DOCUMENTS_FRAMEWORK = {
    "bias-of-climate-change": False,
    "climate-networks": False,
    "climate-trade": False,
    "disaster-assistance": False,
    "enviro-transport": False,
    "regulation-markups": False,
    "simple-reallocation": False,
}


@dataclass(frozen=True)
class DepartureRule:
    """A target repository's stated reason for keeping a path different."""

    path: str
    reason: str


@dataclass(frozen=True)
class PathReason:
    """A path that was left alone and the reason it was not changed."""

    path: str
    reason: str


@dataclass
class SyncReport:
    """Changes for one repository, including protected project choices."""

    repository: str
    branch: str
    mode: str
    added: list[str] = field(default_factory=list)
    updated: list[str] = field(default_factory=list)
    deleted: list[str] = field(default_factory=list)
    untracked: list[str] = field(default_factory=list)
    skipped: list[PathReason] = field(default_factory=list)
    preserved: list[PathReason] = field(default_factory=list)
    departures_honored: list[PathReason] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def has_changes(self) -> bool:
        """Return whether the run found a file or Git index change."""

        return bool(self.added or self.updated or self.deleted or self.untracked)

    def as_dictionary(self) -> dict[str, object]:
        """Return plain values suitable for a JSON report."""

        return asdict(self)


def run_git(repository: Path, arguments: Iterable[str]) -> subprocess.CompletedProcess[bytes]:
    """Run Git in one repository and retain exact path bytes where needed."""

    return subprocess.run(
        ["git", "-C", str(repository), *arguments],
        capture_output=True,
        check=True,
    )


def current_branch(repository: Path) -> str:
    """Read the checked-out branch without changing repository state."""

    result = subprocess.run(
        ["git", "-C", str(repository), "symbolic-ref", "--quiet", "--short", "HEAD"],
        capture_output=True,
    )
    if result.returncode == 0:
        return result.stdout.decode().strip()

    revision = run_git(repository, ("rev-parse", "--short", "HEAD"))
    return f"(detached at {revision.stdout.decode().strip()})"


def tracked_paths(repository: Path) -> set[str]:
    """Return paths currently recorded in the repository's Git index."""

    result = run_git(repository, ("ls-files", "-z"))
    return {
        os.fsdecode(raw_path)
        for raw_path in result.stdout.split(b"\0")
        if raw_path
    }


def normalize_relative_path(raw_path: str) -> str:
    """Return a safe repository-relative path written with forward slashes."""

    normalized = raw_path.replace("\\", "/").rstrip("/")
    parsed = PurePosixPath(normalized)
    if not normalized or parsed.is_absolute() or ".." in parsed.parts:
        raise ValueError(f"Path must stay within the repository: {raw_path!r}")
    return parsed.as_posix()


def is_copy_path(relative_path: str) -> bool:
    """Return whether a tracked template file belongs to the shared copy set."""

    return (
        relative_path.startswith(COPY_PREFIXES)
        or relative_path in COPY_EXACT_PATHS
    ) and relative_path not in COPY_EXCLUDED_PATHS


def template_copy_paths(template_root: Path) -> list[str]:
    """Return the tracked shared files plus this uncommitted tool update."""

    paths = {path for path in tracked_paths(template_root) if is_copy_path(path)}
    if template_root.resolve() == TEMPLATE_ROOT.resolve():
        paths.update(
            relative_path
            for relative_path in CURRENT_UPDATE_PATHS
            if (template_root / relative_path).is_file()
        )
    return sorted(paths)


def path_has_glob(pattern: str) -> bool:
    """Return whether a departure path contains a glob operator."""

    return any(character in pattern for character in "*?[")


def path_matches_pattern(relative_path: str, raw_pattern: str) -> bool:
    """Match a file against a literal path, directory, or forward-slash glob."""

    pattern = normalize_relative_path(raw_pattern)
    path = normalize_relative_path(relative_path)
    if not path_has_glob(pattern):
        return path == pattern or path.startswith(f"{pattern}/")
    return PurePosixPath(path).match(pattern)


def load_departures(repository: Path) -> list[DepartureRule]:
    """Read deliberate differences declared by the target repository."""

    declaration_path = repository / "tools/template_departures.toml"
    if not declaration_path.is_file():
        return []

    try:
        declaration = tomllib.loads(declaration_path.read_text())
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise ValueError(
            f"Cannot read {declaration_path}: {error}"
        ) from error

    raw_departures = declaration.get("departure", [])
    if not isinstance(raw_departures, list):
        raise ValueError(f"{declaration_path} must contain [[departure]] entries")

    departures: list[DepartureRule] = []
    for position, raw_departure in enumerate(raw_departures, start=1):
        if not isinstance(raw_departure, dict):
            raise ValueError(
                f"Departure {position} in {declaration_path} must be a table"
            )
        raw_path = raw_departure.get("path")
        reason = raw_departure.get("reason")
        if not isinstance(raw_path, str) or not isinstance(reason, str):
            raise ValueError(
                f"Departure {position} in {declaration_path} needs text path and reason values"
            )
        if not reason.strip():
            raise ValueError(
                f"Departure {position} in {declaration_path} has an empty reason"
            )
        departures.append(
            DepartureRule(path=normalize_relative_path(raw_path), reason=reason.strip())
        )

    return departures


def matching_departures(
    relative_path: str,
    departures: list[DepartureRule],
) -> list[tuple[int, DepartureRule]]:
    """Return every departure entry that protects one candidate path."""

    return [
        (position, departure)
        for position, departure in enumerate(departures)
        if path_matches_pattern(relative_path, departure.path)
    ]


def preserve_reason(repository_name: str, relative_path: str) -> str | None:
    """Return why a named project file must survive template propagation."""

    path = PurePosixPath(relative_path)

    if repository_name == "climate-networks":
        skill_names = ("write-manuscript", "write-slides", "minimal-reviewer")
        preserved_paths = {
            *(f"protocols/skills/{name}.md" for name in skill_names),
            *(f".claude/skills/{name}/SKILL.md" for name in skill_names),
            *(f".agents/skills/{name}/SKILL.md" for name in skill_names),
            ".claude/agents/minimal-reviewer.md",
        }
        if relative_path in preserved_paths:
            return "Project-specific writing and review instruction"

    if repository_name == "regulation-markups":
        if (
            relative_path == "tools/thorny_loop"
            or relative_path.startswith("tools/thorny_loop/")
        ) and "__pycache__" not in path.parts:
            return "Project-specific thorny-loop source"

    if repository_name == "simple-reallocation" and path.match("tools/*.jl"):
        return "Project-specific Julia tool"

    return None


def never_touch_reason(relative_path: str) -> str | None:
    """Return why a path is outside the permitted synchronization scope."""

    path = PurePosixPath(relative_path)
    if path.parts and path.parts[0] in NEVER_TOUCH_TOP_LEVEL:
        return "Protected project path"
    if relative_path in NEVER_TOUCH_ROOT_FILES:
        return "Protected project file"
    if path.parts and path.parts[0] in {"code", "latex"}:
        if relative_path not in ALLOWED_CODE_AND_LATEX_PATHS:
            return "Analysis or manuscript file"
    return None


def validate_operation_path(relative_path: str) -> None:
    """Reject any operation that falls outside the stated framework paths."""

    reason = never_touch_reason(relative_path)
    if reason is not None:
        raise ValueError(f"Refusing to touch {relative_path}: {reason}")


def path_exists_without_following(path: Path) -> bool:
    """Return whether a path or symlink exists without following the symlink."""

    return os.path.lexists(path)


def safe_parent_directory(repository: Path, relative_path: str, *, apply: bool) -> Path:
    """Return a file's parent after confirming no parent is a symlink."""

    parent = repository
    for part in PurePosixPath(relative_path).parts[:-1]:
        parent = parent / part
        if parent.is_symlink():
            raise ValueError(f"Refusing to write through symlink: {parent}")
        if path_exists_without_following(parent) and not parent.is_dir():
            raise ValueError(f"Expected a directory at {parent}")
        if not path_exists_without_following(parent) and apply:
            parent.mkdir()
    return parent


def comparable_mode(path: Path) -> int:
    """Return the permission bits that Git and command execution rely on."""

    return stat.S_IMODE(path.stat(follow_symlinks=False).st_mode)


def files_match(source: Path, target: Path) -> bool:
    """Compare regular files by contents and executable permission bits."""

    if source.is_symlink():
        return target.is_symlink() and os.readlink(source) == os.readlink(target)
    if target.is_symlink() or not target.is_file():
        return False
    return (
        source.read_bytes() == target.read_bytes()
        and comparable_mode(source) == comparable_mode(target)
    )


def copy_file(source: Path, target: Path) -> None:
    """Copy one file without following an existing target symlink."""

    if path_exists_without_following(target):
        if target.is_dir() and not target.is_symlink():
            raise ValueError(f"Expected a file at {target}, found a directory")
        target.unlink()

    if source.is_symlink():
        target.symlink_to(os.readlink(source))
    else:
        shutil.copy2(source, target, follow_symlinks=False)


def template_check_contents(repository: Path) -> bytes:
    """Declare which optional template parts the target actually carries."""

    has_latex = (repository / "latex").is_dir() and not (
        repository / "latex"
    ).is_symlink()
    has_code = (repository / "code").is_dir() and not (
        repository / "code"
    ).is_symlink()
    readme_documents_framework = README_DOCUMENTS_FRAMEWORK.get(
        repository.name,
        False,
    )

    def toml_boolean(value: bool) -> str:
        return "true" if value else "false"

    text = (
        "# Parts of repo-template present in this repository.\n"
        "# The consistency checker applies only the checks that match this structure.\n\n"
        f"has_latex = {toml_boolean(has_latex)}\n"
        f"has_code = {toml_boolean(has_code)}\n"
        "readme_documents_framework = "
        f"{toml_boolean(readme_documents_framework)}\n"
    )
    return text.encode()


def iter_tree_paths(repository: Path, relative_root: str) -> list[str]:
    """List a named retired tree without following any symlink within it."""

    root = repository / relative_root
    if not path_exists_without_following(root):
        return []
    if root.is_symlink() or not root.is_dir():
        return [relative_root]

    paths: list[str] = []
    for current_root, directory_names, file_names in os.walk(
        root,
        topdown=True,
        followlinks=False,
    ):
        current = Path(current_root)
        symlink_directories = [
            name for name in directory_names if (current / name).is_symlink()
        ]
        directory_names[:] = [
            name for name in directory_names if name not in symlink_directories
        ]
        for name in file_names + symlink_directories:
            paths.append((current / name).relative_to(repository).as_posix())
        for name in directory_names:
            paths.append((current / name).relative_to(repository).as_posix())
    paths.append(relative_root)
    return sorted(paths, key=lambda path: (path.count("/"), path), reverse=True)


def retired_disk_paths(repository: Path) -> list[str]:
    """Return only the named retired files and trees that currently exist."""

    candidates: set[str] = set()
    for relative_root in RETIRED_TREE_PATHS:
        candidates.update(iter_tree_paths(repository, relative_root))

    for relative_path in RETIRED_FILE_PATHS:
        if path_exists_without_following(repository / relative_path):
            candidates.add(relative_path)

    agents_directory = repository / ".codex/agents"
    if agents_directory.is_dir() and not agents_directory.is_symlink():
        for candidate in agents_directory.iterdir():
            if candidate.name.endswith(".toml"):
                candidates.add(candidate.relative_to(repository).as_posix())

    return sorted(
        candidates,
        key=lambda path: (path.count("/"), path),
        reverse=True,
    )


def untrack_only_paths(repository: Path, indexed_paths: set[str]) -> list[str]:
    """Return ignored local files that should remain on disk but leave Git."""

    candidates = {
        relative_path
        for relative_path in UNTRACK_ONLY_PATHS
        if relative_path in indexed_paths
    }
    candidates.update(
        relative_path
        for relative_path in indexed_paths
        if "__pycache__" in PurePosixPath(relative_path).parts
        and relative_path.endswith(".pyc")
    )
    return sorted(candidates)


def remove_from_index(repository: Path, relative_path: str) -> None:
    """Remove one named path from Git while retaining full command errors."""

    run_git(
        repository,
        ("rm", "--cached", "--ignore-unmatch", "-f", "--", relative_path),
    )


def record_departures(
    relative_path: str,
    matches: list[tuple[int, DepartureRule]],
    report: SyncReport,
    matched_departure_positions: set[int],
) -> None:
    """Record each reason a candidate path was deliberately left alone."""

    existing = {(item.path, item.reason) for item in report.departures_honored}
    for position, departure in matches:
        matched_departure_positions.add(position)
        key = (relative_path, departure.reason)
        if key not in existing:
            report.departures_honored.append(
                PathReason(path=relative_path, reason=departure.reason)
            )
            existing.add(key)


def record_preserved(report: SyncReport, relative_path: str, reason: str) -> None:
    """Record a named project path once."""

    if not any(item.path == relative_path for item in report.preserved):
        report.preserved.append(PathReason(path=relative_path, reason=reason))


def existing_preserved_paths(repository: Path) -> list[PathReason]:
    """List named project files so the report confirms they survived."""

    repository_name = repository.name
    candidates: set[str] = set()

    if repository_name == "climate-networks":
        skill_names = ("write-manuscript", "write-slides", "minimal-reviewer")
        candidates.update(f"protocols/skills/{name}.md" for name in skill_names)
        candidates.update(
            f".claude/skills/{name}/SKILL.md" for name in skill_names
        )
        candidates.update(f".agents/skills/{name}/SKILL.md" for name in skill_names)
        candidates.add(".claude/agents/minimal-reviewer.md")

    if repository_name == "regulation-markups":
        candidates.update(iter_tree_paths(repository, "tools/thorny_loop"))

    if repository_name == "simple-reallocation":
        tools_directory = repository / "tools"
        if tools_directory.is_dir() and not tools_directory.is_symlink():
            candidates.update(
                path.relative_to(repository).as_posix()
                for path in tools_directory.iterdir()
                if path.is_file() and path.suffix == ".jl"
            )

    preserved: list[PathReason] = []
    for relative_path in sorted(candidates):
        if not path_exists_without_following(repository / relative_path):
            continue
        reason = preserve_reason(repository_name, relative_path)
        if reason is not None:
            preserved.append(PathReason(path=relative_path, reason=reason))
    return preserved


def copy_shared_files(
    template_root: Path,
    repository: Path,
    apply: bool,
    departures: list[DepartureRule],
    report: SyncReport,
    matched_departure_positions: set[int],
) -> None:
    """Copy shared files while respecting structure and project choices."""

    repository_name = repository.name
    has_code = (repository / "code").is_dir() and not (
        repository / "code"
    ).is_symlink()
    has_latex = (repository / "latex").is_dir() and not (
        repository / "latex"
    ).is_symlink()

    for relative_path in template_copy_paths(template_root):
        validate_operation_path(relative_path)
        matches = matching_departures(relative_path, departures)
        if matches:
            record_departures(
                relative_path,
                matches,
                report,
                matched_departure_positions,
            )
            continue

        if relative_path.startswith("code/") and not has_code:
            report.skipped.append(
                PathReason(path=relative_path, reason="Target has no code directory")
            )
            continue
        if relative_path.startswith("latex/") and not has_latex:
            report.skipped.append(
                PathReason(path=relative_path, reason="Target has no latex directory")
            )
            continue

        reason = preserve_reason(repository_name, relative_path)
        if reason is not None:
            record_preserved(report, relative_path, reason)
            continue

        source_path = template_root / relative_path
        target_path = repository / relative_path
        if not source_path.is_file() and not source_path.is_symlink():
            raise FileNotFoundError(f"Template copy path is missing: {source_path}")

        target_exists = path_exists_without_following(target_path)
        if target_exists and files_match(source_path, target_path):
            continue

        if target_exists:
            report.updated.append(relative_path)
        else:
            report.added.append(relative_path)

        if apply:
            safe_parent_directory(repository, relative_path, apply=True)
            copy_file(source_path, target_path)


def generate_template_check(
    repository: Path,
    apply: bool,
    departures: list[DepartureRule],
    report: SyncReport,
    matched_departure_positions: set[int],
) -> None:
    """Write the repository's optional-part declaration from its directories."""

    relative_path = "tools/template_check.toml"
    matches = matching_departures(relative_path, departures)
    if matches:
        record_departures(
            relative_path,
            matches,
            report,
            matched_departure_positions,
        )
        return

    target_path = repository / relative_path
    expected_contents = template_check_contents(repository)
    target_exists = path_exists_without_following(target_path)
    if target_exists and not target_path.is_symlink() and target_path.is_file():
        if target_path.read_bytes() == expected_contents:
            return
    elif target_exists and target_path.is_dir() and not target_path.is_symlink():
        raise ValueError(f"Expected a file at {target_path}, found a directory")

    if target_exists:
        report.updated.append(relative_path)
    else:
        report.added.append(relative_path)

    if apply:
        safe_parent_directory(repository, relative_path, apply=True)
        if target_path.is_symlink():
            target_path.unlink()
        target_path.write_bytes(expected_contents)


def remove_retired_files(
    repository: Path,
    apply: bool,
    departures: list[DepartureRule],
    report: SyncReport,
    matched_departure_positions: set[int],
    indexed_paths: set[str],
) -> None:
    """Remove only named retired files and empty directories."""

    repository_name = repository.name
    for relative_path in retired_disk_paths(repository):
        validate_operation_path(relative_path)
        matches = matching_departures(relative_path, departures)
        if matches:
            record_departures(
                relative_path,
                matches,
                report,
                matched_departure_positions,
            )
            continue

        reason = preserve_reason(repository_name, relative_path)
        if reason is not None:
            record_preserved(report, relative_path, reason)
            continue

        target_path = repository / relative_path
        if target_path.is_dir() and not target_path.is_symlink():
            if apply:
                try:
                    target_path.rmdir()
                except OSError:
                    continue
            report.deleted.append(relative_path)
            continue

        if relative_path in indexed_paths and apply:
            remove_from_index(repository, relative_path)
        if apply and path_exists_without_following(target_path):
            target_path.unlink()
        report.deleted.append(relative_path)


def remove_empty_retired_directories(
    repository: Path,
    apply: bool,
    departures: list[DepartureRule],
    report: SyncReport,
    matched_departure_positions: set[int],
) -> None:
    """Remove named retired directories only when no retained entry remains."""

    for relative_path in REMOVE_WHEN_EMPTY_PATHS:
        target_path = repository / relative_path
        if not target_path.is_dir() or target_path.is_symlink():
            continue

        matches = matching_departures(relative_path, departures)
        if matches:
            record_departures(
                relative_path,
                matches,
                report,
                matched_departure_positions,
            )
            continue

        children = list(target_path.iterdir())
        if apply:
            if children:
                continue
            target_path.rmdir()
            report.deleted.append(relative_path)
            continue

        planned_deletions = set(report.deleted)
        child_paths = {
            child.relative_to(repository).as_posix()
            for child in children
        }
        if child_paths.issubset(planned_deletions):
            report.deleted.append(relative_path)


def untrack_ignored_files(
    repository: Path,
    apply: bool,
    departures: list[DepartureRule],
    report: SyncReport,
    matched_departure_positions: set[int],
    indexed_paths: set[str],
) -> None:
    """Leave local ignored files on disk while removing them from Git."""

    for relative_path in untrack_only_paths(repository, indexed_paths):
        validate_operation_path(relative_path)
        matches = matching_departures(relative_path, departures)
        if matches:
            record_departures(
                relative_path,
                matches,
                report,
                matched_departure_positions,
            )
            continue

        reason = preserve_reason(repository.name, relative_path)
        if reason is not None:
            record_preserved(report, relative_path, reason)
            continue

        if apply:
            remove_from_index(repository, relative_path)
        report.untracked.append(relative_path)


def sync_repository(
    template_root: Path,
    repository: Path,
    *,
    apply: bool,
) -> SyncReport:
    """Synchronize one repository and return a complete review record."""

    template_root = template_root.resolve()
    repository = repository.resolve()
    if template_root == repository:
        raise ValueError("The target repository must differ from the template")
    if not repository.is_dir():
        raise FileNotFoundError(f"Target repository is missing: {repository}")

    branch = current_branch(repository)
    departures = load_departures(repository)
    indexed_paths = tracked_paths(repository)
    report = SyncReport(
        repository=str(repository),
        branch=branch,
        mode="apply" if apply else "dry-run",
    )
    report.preserved.extend(existing_preserved_paths(repository))
    matched_departure_positions: set[int] = set()

    copy_shared_files(
        template_root,
        repository,
        apply,
        departures,
        report,
        matched_departure_positions,
    )
    generate_template_check(
        repository,
        apply,
        departures,
        report,
        matched_departure_positions,
    )
    remove_retired_files(
        repository,
        apply,
        departures,
        report,
        matched_departure_positions,
        indexed_paths,
    )
    remove_empty_retired_directories(
        repository,
        apply,
        departures,
        report,
        matched_departure_positions,
    )
    untrack_ignored_files(
        repository,
        apply,
        departures,
        report,
        matched_departure_positions,
        indexed_paths,
    )

    for position, departure in enumerate(departures):
        if position not in matched_departure_positions:
            report.warnings.append(
                f"Departure pattern matched no synchronization path: "
                f"{departure.path} ({departure.reason})"
            )

    report.added.sort()
    report.updated.sort()
    report.deleted.sort()
    report.untracked.sort()
    report.skipped.sort(key=lambda item: (item.path, item.reason))
    report.preserved.sort(key=lambda item: (item.path, item.reason))
    report.departures_honored.sort(key=lambda item: (item.path, item.reason))
    return report


def print_path_list(title: str, paths: list[str]) -> None:
    """Print one summary category in a compact, reviewable form."""

    print(f"{title} ({len(paths)}):")
    for path in paths:
        print(f"  {path}")


def print_reason_list(title: str, paths: list[PathReason]) -> None:
    """Print paths that were retained for stated reasons."""

    print(f"{title} ({len(paths)}):")
    for item in paths:
        print(f"  {item.path}: {item.reason}")


def print_report(report: SyncReport) -> None:
    """Print one repository report for direct command-line review."""

    print(f"Repository: {report.repository}")
    print(f"Branch: {report.branch}")
    print(f"Mode: {report.mode}")
    print_path_list("Added", report.added)
    print_path_list("Updated", report.updated)
    print_path_list("Deleted", report.deleted)
    print_path_list("Untracked but kept on disk", report.untracked)
    print_reason_list("Skipped", report.skipped)
    print_reason_list("Preserved", report.preserved)
    print_reason_list("Departures honored", report.departures_honored)
    print(f"Warnings ({len(report.warnings)}):")
    for warning in report.warnings:
        print(f"  {warning}")


def write_json_report(report_path: Path, reports: list[SyncReport]) -> None:
    """Write all repository results to one machine-readable report."""

    report_path = report_path.resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps([report.as_dictionary() for report in reports], indent=2)
        + "\n"
    )


def parse_arguments(arguments: list[str] | None = None) -> argparse.Namespace:
    """Read command-line arguments for one or more target repositories."""

    parser = argparse.ArgumentParser(
        description="Copy shared repo-template files to research repositories."
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
    """Run synchronization and print a separate summary for each target."""

    parsed = parse_arguments(arguments)
    reports: list[SyncReport] = []
    try:
        for position, repository in enumerate(parsed.repo):
            if position:
                print()
            report = sync_repository(
                TEMPLATE_ROOT,
                repository,
                apply=parsed.apply,
            )
            reports.append(report)
            print_report(report)
        if parsed.report is not None:
            write_json_report(parsed.report, reports)
    except (FileNotFoundError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Template synchronization failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
