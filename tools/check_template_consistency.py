#!/usr/bin/env python3
"""Validate shared skills, permissions, and routed project conventions."""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tomllib
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


REPO_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class DepartureRule:
    """A reason this repository keeps one shared path different."""

    path: str
    reason: str


def normalize_departure_path(raw_path: str) -> str:
    """Return a repository-relative departure path with forward slashes."""

    normalized = raw_path.replace("\\", "/").rstrip("/")
    parsed = PurePosixPath(normalized)
    if not normalized or parsed.is_absolute() or ".." in parsed.parts:
        raise ValueError(f"Departure path must stay within the repository: {raw_path!r}")
    return parsed.as_posix()


def load_departure_rules() -> tuple[DepartureRule, ...]:
    """Read deliberate file differences separately from structural declarations."""

    declaration_path = REPO_ROOT / "tools/template_departures.toml"
    if not declaration_path.is_file():
        return ()

    declaration = tomllib.loads(declaration_path.read_text())
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
            DepartureRule(
                path=normalize_departure_path(raw_path),
                reason=reason.strip(),
            )
        )
    return tuple(departures)


DEPARTURE_RULES = load_departure_rules()
SKIPPED_DEPARTURE_CHECKS: set[tuple[str, str, str]] = set()


def departure_matches_path(departure_path: str, relative_path: str) -> bool:
    """Match one literal path, directory, or forward-slash glob."""

    if not any(character in departure_path for character in "*?["):
        return relative_path == departure_path or relative_path.startswith(
            f"{departure_path}/"
        )
    return PurePosixPath(relative_path).match(departure_path)


def skip_departed_check(relative_path: str, check_name: str) -> bool:
    """Record and skip a check whose subject path is a declared departure."""

    matching_rules = [
        departure
        for departure in DEPARTURE_RULES
        if departure_matches_path(departure.path, relative_path)
    ]
    for departure in matching_rules:
        SKIPPED_DEPARTURE_CHECKS.add(
            (relative_path, check_name, departure.reason)
        )
    return bool(matching_rules)


def skip_if_any_path_departed(
    relative_paths: tuple[str, ...],
    check_name: str,
) -> bool:
    """Record all departed subjects and return whether an aggregate check skips."""

    results = [
        skip_departed_check(relative_path, check_name)
        for relative_path in relative_paths
    ]
    return any(results)


def git_tracks_path(relative_path: str) -> bool:
    """Return whether Git records a path as part of project settings."""

    result = subprocess.run(
        [
            "git",
            "-C",
            str(REPO_ROOT),
            "ls-files",
            "--error-unmatch",
            "--",
            relative_path,
        ],
        capture_output=True,
    )
    return result.returncode == 0

WRAPPER_PROTOCOL_MARKERS = (
    "## Review Protocol",
    "### Review Categories",
    "## Workflow Phases",
    "## Proofreading Protocol",
    "## The Five-Lens Protocol",
)

REVIEW_AGENT_PROTOCOLS = {
    "domain-reviewer": "review-domain",
    "julia-reviewer": "review-julia",
    "makefile-reviewer": "review-makefile",
    "matlab-reviewer": "review-matlab",
    "proofreader": "proofread",
    "r-reviewer": "review-r",
    "stata-reviewer": "review-stata",
    "tex-reviewer": "review-tex",
}

CODE_CONVENTION_ROUTES = {
    "r-reviewer": "protocols/conventions/r.md",
    "julia-reviewer": "protocols/conventions/julia.md",
    "stata-reviewer": "protocols/conventions/stata.md",
    "matlab-reviewer": "protocols/conventions/matlab.md",
    "makefile-reviewer": "protocols/conventions/makefile.md",
}

WORKFLOW_REQUIRED_SNIPPETS = {
    "AGENTS.md": (
        "## Risk-Based Workflow",
        "### Selecting a Reviewer",
        "**Workflow:** Risk-based",
        "do not spawn one\nreviewer per file type",
        "Use a full multi-agent loop only when the user explicitly requests it",
        "Documentation or instruction-only changes do not require a Make dry run.",
        "Do not perform a scoring exercise after every routine edit.",
        "Whenever a generated numeric macro changes value, review every prose",
        "pause until the user says\n  whether to continue in the current session",
    ),
    "CLAUDE.md": (
        "routine work needs no plan",
        "Start a fresh session, or use `/clear`, when changing task or branch",
        "pause until the user says whether\n  to continue in the current session",
        "Allow one\nCodex fix and one Claude re-review by default.",
        "Do not pin Claude's `effortLevel` or model in tracked Claude project",
        "when a generated numeric macro changes value,",
    ),
    "README.md": (
        "applies the risk-based workflow",
        "choose at most one **opt-in review pass**",
        "Do not score every routine edit.",
        "Prefer user-level configuration or explicit session/CLI overrides",
        "When an agent-driven build can rewrite `output/numbers/`",
    ),
    "latex/AGENTS.md": (
        "Whenever a generated numeric macro",
        "Keep generated macros value-only.",
    ),
    "protocols/conventions/makefile.md": (
        "When a Makefile or dependency declaration changes, run a scoped `make -n`",
    ),
}

WORKFLOW_FORBIDDEN_PATTERNS = {
    "README.md": (
        re.compile(r"contractor\s+mode", re.IGNORECASE),
        re.compile(r"every\s+file\s+gets\s+a\s+score", re.IGNORECASE),
        re.compile(r"review[- ]fix\s+loop", re.IGNORECASE),
        re.compile(r"core\s+workflow,\s+orchestrators", re.IGNORECASE),
        re.compile(r"repo-specific\s+model,\s+add\s+that\s+pin", re.IGNORECASE),
        re.compile(r"log-reminder\.py"),
    ),
    ".claude/settings.json.example": (re.compile(r"log-reminder\.py"),),
    "protocols/conventions/makefile.md": (
        re.compile(r"make -n.*must produce a valid plan", re.IGNORECASE),
    ),
}

COMMIT_PROTOCOL_REQUIRED_SNIPPETS = (
    "If the current branch is a non-`main` branch, keep using it.",
    "If the current branch is `main`, detached, or the user explicitly asks for a",
    "Keep branch naming tool-neutral.",
    "Choose Make verification in proportion to the files being committed:",
    "Documentation and instruction-only changes require no Make dry run.",
)

COMMIT_PROTOCOL_FORBIDDEN_SNIPPETS = (
    "Always create a new branch.",
)

COMMIT_PROTOCOL_FORBIDDEN_PATTERNS = (
    re.compile(r"(?<!\.)codex/"),
)

PROTOCOL_REQUIRED_SNIPPETS = {
    "protocols/skills/compare-branches.md": (
        "run `make -n`",
        "rebuild them with `make`",
        "Output Verification Formats guidance in `AGENTS.md`",
    ),
    "protocols/skills/setup-makefile.md": (
        "`.R`, `.jl`, `.do`, `.ado`, and `.m`",
        "`export delimited`",
        "`file write`",
        "`$(STATA) -b do $<`",
        "file.path(\"..\", \"..\", \"output\")",
        "joinpath(\"..\", \"..\", \"output\")",
        "OUTPUT_ROOT ?= ../../output",
    ),
    "protocols/skills/verify-outputs.md": (
        "`export delimited`",
        "`putexcel`",
        "`esttab`",
        "`file write`",
    ),
    "protocols/skills/review-makefile.md": (
        "`.R`, `.jl`, `.do`, `.ado`, and `.m`",
        "`$(STATA) -b do $<`",
    ),
    "protocols/skills/review-tex.md": (
        "Compare macro contents, not file modification times.",
        "Review every prose occurrence of each changed macro",
        "Keep generated macros value-only.",
    ),
}

PATH_MODEL_REQUIRED_SNIPPETS = {
    "AGENTS.md": (
        "Run all Make commands below from the repository root.",
        "`make -C path` changes Make's working directory",
        "`code/[subdir]/` as the command's working directory",
        "`Rscript script.R`",
        "`julia script.jl`",
        "`stata -b do script.do`",
        "`matlab -batch \"run('script.m')\"`",
    ),
    "CLAUDE.md": (
        "Run all Make commands below from the repository root.",
        "`make -C path` changes Make's working directory",
    ),
    "code/AGENTS.md": (
        "../protocols/conventions/shared.md",
        "../protocols/conventions/r.md",
        "../protocols/conventions/julia.md",
        "../protocols/conventions/stata.md",
        "../protocols/conventions/matlab.md",
        "../protocols/conventions/makefile.md",
    ),
    "protocols/conventions/shared.md": (
        "paths in task-group Makefiles",
        "the scripts they run are relative to the task-group directory",
        "Do not add a `PROJECT_ROOT` variable merely",
        "Use forward slashes in any literal filepath",
    ),
    "protocols/conventions/r.md": (
        "script working directory",
        'output_root = file.path("..", "..", "output")',
    ),
    "protocols/conventions/julia.md": (
        "script working directory",
        'output_root = joinpath("..", "..", "output")',
    ),
    "protocols/conventions/stata.md": (
        "script working directory",
        'local output_root "../../output"',
    ),
    "protocols/conventions/matlab.md": (
        "script working directory",
        'output_root = fullfile("..", "..", "output");',
    ),
    "protocols/conventions/makefile.md": (
        "OUTPUT_ROOT = ../../output",
    ),
    "README.md": (
        "Run these Make commands from the project root.",
        "targets, prerequisites, and scripts use paths",
        "working-directory-relative",
        'output_root = file.path("..", "..", "output")',
        'output_root = joinpath("..", "..", "output")',
        'local output_root "../../output"',
        'output_root = fullfile("..", "..", "output");',
    ),
}

PATH_MODEL_FORBIDDEN_SNIPPETS = {
    "AGENTS.md": (
        "fall back to `Rscript path/to/script.R`",
        "fall back to `julia path/to/script.jl`",
        "fall back to `stata -b do path/to/script.do`",
        "fall back to `matlab -batch",
    ),
    "protocols/conventions/shared.md": (
        "relative to repository root",
        "Use repo-relative paths only",
    ),
    "protocols/conventions/r.md": (
        "code/analysis.R | output/tables",
        'file.path("output", "figures", "my_plot.pdf")',
    ),
    "protocols/conventions/julia.md": (
        'joinpath("output", "figures", "my_plot.pdf")',
    ),
    "protocols/conventions/stata.md": (
        'save "output/tables/my_results.dta", replace',
    ),
    "protocols/conventions/matlab.md": (
        'fullfile("output", "tables", "results.csv")',
    ),
}

CLAUDE_WRAPPER_REQUIRED_SNIPPETS = {
    "code/CLAUDE.md": (
        "[AGENTS.md](./AGENTS.md)",
        "source of truth",
        "../protocols/conventions/shared.md",
    ),
    "latex/CLAUDE.md": ("[AGENTS.md](./AGENTS.md)", "source of truth"),
}

WRITING_GUIDE_REQUIRED_SNIPPETS = {
    "protocols/writing.md": (
        "## The Audience Test",
        "## Banned Programmer Vocabulary",
        "| sanity check |",
    ),
    "CLAUDE.md": ("protocols/writing.md",),
    "AGENTS.md": ("protocols/writing.md",),
    "latex/AGENTS.md": ("protocols/writing.md",),
    "protocols/conventions/shared.md": ("protocols/writing.md",),
    "protocols/skills/review-comments.md": ("protocols/writing.md",),
}

LEGACY_RULE_REFERENCE_GLOBS = (
    "README.md",
    "CLAUDE.md",
    "protocols/skills/*.md",
    ".claude/agents/*.md",
)

# Optional parts of the template that a project may legitimately not have.
# Each entry maps a checked path, or a path prefix, to the declaration that
# says whether this repository carries that part.
SURFACE_GATES = {
    "README.md": "readme_documents_framework",
    "latex/": "has_latex",
    "code/": "has_code",
}

SURFACE_DEFAULTS = {
    "has_latex": True,
    "has_code": True,
    "readme_documents_framework": True,
}


def load_surface_flags() -> dict[str, bool]:
    """Return which optional parts of the template this repository carries.

    Projects built from this template differ in structure. Some keep the
    manuscript in an Overleaf checkout and have no `latex/` directory, some
    have no `code/` directory, and most have a project README rather than the
    template's own framework documentation. Each repository declares what it
    has in `tools/template_check.toml`, so this checker can stay identical
    everywhere while still applying every check that does apply.
    """
    config_path = REPO_ROOT / "tools/template_check.toml"
    if not config_path.is_file():
        return dict(SURFACE_DEFAULTS)

    declared = tomllib.loads(config_path.read_text())

    return {
        name: bool(declared.get(name, default))
        for name, default in SURFACE_DEFAULTS.items()
    }


SURFACE_FLAGS = load_surface_flags()


def path_applies(relative_path: str) -> bool:
    """Return whether a checked path is part of this repository's structure."""
    for prefix, flag_name in SURFACE_GATES.items():
        if relative_path.startswith(prefix):
            return SURFACE_FLAGS[flag_name]

    return True


def load_claude_bash_permissions() -> set[str]:
    settings_path = REPO_ROOT / ".claude/settings.json.example"
    settings = json.loads(settings_path.read_text())
    permissions = settings["permissions"]["allow"]
    pattern = re.compile(r"Bash\(([^ ]+) \*\)")
    command_prefixes = set()

    for entry in permissions:
        match = pattern.fullmatch(entry)
        if match:
            command_prefixes.add(match.group(1))

    return command_prefixes


def load_claude_permission_patterns() -> set[str]:
    """Return the complete allow-list patterns from the Claude settings example."""
    settings_path = REPO_ROOT / ".claude/settings.json.example"
    settings = json.loads(settings_path.read_text())

    return set(settings["permissions"]["allow"])


def load_codex_prefix_rules() -> set[str]:
    rules_path = REPO_ROOT / ".codex/rules/default.rules"
    pattern = re.compile(r'prefix_rule\(pattern=\["([^"]+)"\]')
    command_prefixes = set()

    for line in rules_path.read_text().splitlines():
        match = pattern.search(line)
        if match:
            command_prefixes.add(match.group(1))

    return command_prefixes


def load_kimi_permission_patterns(errors: list[str]) -> tuple[set[str], set[str]]:
    """Return (allowed, denied) permission patterns from the Kimi example config."""
    config_path = REPO_ROOT / ".kimi-code/config.toml.example"
    allowed: set[str] = set()
    denied: set[str] = set()

    try:
        config = tomllib.loads(config_path.read_text())
    except (OSError, tomllib.TOMLDecodeError) as exc:
        errors.append(f".kimi-code/config.toml.example is not valid TOML: {exc}")
        return allowed, denied

    for rule in config.get("permission", {}).get("rules", []):
        rule_pattern = str(rule.get("pattern", ""))
        if not rule_pattern:
            continue
        if rule.get("decision") != "allow":
            denied.add(rule_pattern)
            continue
        allowed.add(rule_pattern)

    return allowed, denied


def collect_skill_names(base_dir: Path) -> set[str]:
    return {path.parent.name for path in base_dir.glob("*/SKILL.md")}


def collect_protocol_names() -> set[str]:
    return {path.stem for path in (REPO_ROOT / "protocols/skills").glob("*.md")}


def check_wrapper_protocol_refs(wrapper_dir: Path, errors: list[str]) -> None:
    for wrapper_path in wrapper_dir.glob("*/SKILL.md"):
        skill_name = wrapper_path.parent.name
        relative_path = wrapper_path.relative_to(REPO_ROOT).as_posix()
        if skip_departed_check(relative_path, "skill wrapper protocol reference"):
            continue
        expected_ref = f"protocols/skills/{skill_name}.md"
        wrapper_text = wrapper_path.read_text()

        if expected_ref not in wrapper_text:
            errors.append(
                f"{wrapper_path.relative_to(REPO_ROOT)} is missing reference to {expected_ref}"
            )

        for marker in WRAPPER_PROTOCOL_MARKERS:
            if marker in wrapper_text:
                errors.append(
                    f"{wrapper_path.relative_to(REPO_ROOT)} still contains protocol marker '{marker}'"
                )


def check_agent_protocol_refs(errors: list[str]) -> None:
    agents_dir = REPO_ROOT / ".claude/agents"

    for agent_name, protocol_name in REVIEW_AGENT_PROTOCOLS.items():
        agent_path = agents_dir / f"{agent_name}.md"
        relative_path = agent_path.relative_to(REPO_ROOT).as_posix()
        if skip_departed_check(relative_path, "review agent protocol reference"):
            continue
        expected_ref = f"protocols/skills/{protocol_name}.md"
        agent_text = agent_path.read_text()

        if expected_ref not in agent_text:
            errors.append(
                f"{agent_path.relative_to(REPO_ROOT)} is missing reference to {expected_ref}"
            )

        for marker in WRAPPER_PROTOCOL_MARKERS:
            if marker in agent_text:
                errors.append(
                    f"{agent_path.relative_to(REPO_ROOT)} still contains protocol marker '{marker}'"
                )


def check_review_skill_agent_scope(errors: list[str]) -> None:
    for agent_name, protocol_name in REVIEW_AGENT_PROTOCOLS.items():
        skill_path = REPO_ROOT / ".claude/skills" / protocol_name / "SKILL.md"
        relative_path = skill_path.relative_to(REPO_ROOT).as_posix()
        if skip_departed_check(relative_path, "review skill agent scope"):
            continue
        skill_text = skill_path.read_text()
        expected_text = (
            f"Launch one `{agent_name}` agent for the full approved target scope"
        )

        if expected_text not in skill_text:
            errors.append(
                f"{skill_path.relative_to(REPO_ROOT)} does not require one scoped reviewer agent"
            )
        if "for each target" in skill_text:
            errors.append(
                f"{skill_path.relative_to(REPO_ROOT)} still requests reviewer fan-out"
            )


def check_code_convention_routes(errors: list[str]) -> None:
    shared_path = REPO_ROOT / "protocols/conventions/shared.md"
    if not skip_departed_check(
        "protocols/conventions/shared.md",
        "shared code convention presence",
    ) and not shared_path.is_file():
        errors.append("protocols/conventions/shared.md is missing")

    for agent_name, convention_name in CODE_CONVENTION_ROUTES.items():
        convention_path = REPO_ROOT / convention_name
        if not skip_departed_check(
            convention_name,
            "language convention presence",
        ) and not convention_path.is_file():
            errors.append(f"{convention_name} is missing")

        agent_relative_path = f".claude/agents/{agent_name}.md"
        agent_text = read_required_file(
            agent_relative_path,
            errors,
            check_name="review agent convention routes",
        )
        if agent_text is None:
            continue
        if "protocols/conventions/shared.md" not in agent_text:
            errors.append(
                f"{agent_relative_path} does not load the shared code convention"
            )
        if convention_name not in agent_text:
            errors.append(f"{agent_relative_path} does not load {convention_name}")


def check_claude_project_defaults(errors: list[str]) -> None:
    settings_paths = (
        (".claude/settings.json.example", False),
        (".claude/settings.json", True),
    )

    for relative_path, require_tracking in settings_paths:
        settings_path = REPO_ROOT / relative_path
        if not settings_path.is_file():
            continue
        if require_tracking and not git_tracks_path(relative_path):
            continue
        if skip_departed_check(relative_path, "Claude project defaults"):
            continue

        settings = json.loads(settings_path.read_text())
        for forbidden_key in ("effortLevel", "model"):
            if forbidden_key in settings:
                errors.append(
                    f"{settings_path.relative_to(REPO_ROOT)} pins Claude {forbidden_key}"
                )


def read_required_file(
    relative_path: str,
    errors: list[str],
    *,
    check_name: str = "required file content",
) -> str | None:
    """Return the text of a required template file, or None if it is absent.

    Recording a missing file as an ordinary error keeps the report readable
    when a file is moved or renamed, rather than ending the run with a
    traceback. Files belonging to a part of the template this repository does
    not carry are skipped without an error.
    """
    if skip_departed_check(relative_path, check_name):
        return None
    if not path_applies(relative_path):
        return None

    file_path = REPO_ROOT / relative_path
    if not file_path.is_file():
        errors.append(f"{relative_path} is missing")
        return None
    return file_path.read_text()


def read_present_file(
    relative_path: str,
    *,
    check_name: str = "retired text",
) -> str | None:
    """Return the text of a file if it exists, without requiring it.

    Checks for obsolete text apply to whatever a repository actually has, even
    where the file is a project's own document rather than a copy of the
    template's.
    """
    if skip_departed_check(relative_path, check_name):
        return None
    file_path = REPO_ROOT / relative_path
    if not file_path.is_file():
        return None
    return file_path.read_text()


def check_workflow_policy(errors: list[str]) -> None:
    for relative_path, snippets in WORKFLOW_REQUIRED_SNIPPETS.items():
        file_text = read_required_file(
            relative_path,
            errors,
            check_name="required workflow policy",
        )
        if file_text is None:
            continue
        for snippet in snippets:
            if snippet not in file_text:
                errors.append(
                    f"{relative_path} is missing workflow policy text: {snippet!r}"
                )

    for relative_path, patterns in WORKFLOW_FORBIDDEN_PATTERNS.items():
        file_text = read_present_file(
            relative_path,
            check_name="retired workflow policy",
        )
        if file_text is None:
            continue
        for pattern in patterns:
            if pattern.search(file_text):
                errors.append(
                    f"{relative_path} contains obsolete workflow text matching {pattern.pattern!r}"
                )

    obsolete_hook = REPO_ROOT / ".claude/hooks/log-reminder.py"
    if not skip_departed_check(
        ".claude/hooks/log-reminder.py",
        "retired session-logging hook",
    ) and obsolete_hook.exists():
        errors.append(
            ".claude/hooks/log-reminder.py still enforces mandatory session logging"
        )


def check_commit_protocol_branch_policy(errors: list[str]) -> None:
    commit_protocol_path = REPO_ROOT / "protocols/skills/commit.md"
    if skip_departed_check(
        "protocols/skills/commit.md",
        "commit branch policy",
    ):
        return
    commit_protocol_text = commit_protocol_path.read_text()

    for snippet in COMMIT_PROTOCOL_REQUIRED_SNIPPETS:
        if snippet not in commit_protocol_text:
            errors.append(
                f"{commit_protocol_path.relative_to(REPO_ROOT)} is missing branch-policy text: {snippet!r}"
            )

    for snippet in COMMIT_PROTOCOL_FORBIDDEN_SNIPPETS:
        if snippet in commit_protocol_text:
            errors.append(
                f"{commit_protocol_path.relative_to(REPO_ROOT)} still contains forbidden branch-policy text: {snippet!r}"
            )

    for pattern in COMMIT_PROTOCOL_FORBIDDEN_PATTERNS:
        if pattern.search(commit_protocol_text):
            errors.append(
                f"{commit_protocol_path.relative_to(REPO_ROOT)} still contains a tool-specific branch prefix matching {pattern.pattern!r}"
            )


def check_protocol_required_snippets(errors: list[str]) -> None:
    for relative_path, snippets in PROTOCOL_REQUIRED_SNIPPETS.items():
        protocol_text = read_required_file(
            relative_path,
            errors,
            check_name="required skill protocol text",
        )
        if protocol_text is None:
            continue

        for snippet in snippets:
            if snippet not in protocol_text:
                errors.append(
                    f"{relative_path} is missing required protocol text: {snippet!r}"
                )


def check_path_model_snippets(errors: list[str]) -> None:
    for relative_path, snippets in PATH_MODEL_REQUIRED_SNIPPETS.items():
        file_text = read_required_file(
            relative_path,
            errors,
            check_name="required path model",
        )
        if file_text is None:
            continue

        for snippet in snippets:
            if snippet not in file_text:
                errors.append(
                    f"{relative_path} is missing required path-model text: {snippet!r}"
                )

    for relative_path, snippets in PATH_MODEL_FORBIDDEN_SNIPPETS.items():
        file_text = read_present_file(
            relative_path,
            check_name="forbidden path model",
        )
        if file_text is None:
            continue

        for snippet in snippets:
            if snippet in file_text:
                errors.append(
                    f"{relative_path} still contains forbidden path-model text: {snippet!r}"
                )


def check_claude_wrappers(errors: list[str]) -> None:
    for relative_path, snippets in CLAUDE_WRAPPER_REQUIRED_SNIPPETS.items():
        file_text = read_required_file(
            relative_path,
            errors,
            check_name="Claude wrapper source-of-truth reference",
        )
        if file_text is None:
            continue

        for snippet in snippets:
            if snippet not in file_text:
                errors.append(
                    f"{relative_path} is missing required Claude-wrapper text: {snippet!r}"
                )


def check_writing_guide(errors: list[str]) -> None:
    for relative_path, snippets in WRITING_GUIDE_REQUIRED_SNIPPETS.items():
        file_text = read_required_file(
            relative_path,
            errors,
            check_name="writing guide reference",
        )
        if file_text is None:
            continue

        for snippet in snippets:
            if snippet not in file_text:
                errors.append(
                    f"{relative_path} is missing required writing-guide text: {snippet!r}"
                )


def check_no_legacy_rule_refs(errors: list[str]) -> None:
    for pattern in LEGACY_RULE_REFERENCE_GLOBS:
        for file_path in REPO_ROOT.glob(pattern):
            relative_path = file_path.relative_to(REPO_ROOT).as_posix()
            if skip_departed_check(relative_path, "retired rule reference"):
                continue
            file_text = file_path.read_text()
            if ".claude/rules/" in file_text:
                errors.append(
                    f"{file_path.relative_to(REPO_ROOT)} still references deleted .claude/rules content"
                )


def check_claude_rules_dir(errors: list[str]) -> None:
    if skip_departed_check(".claude/rules", "retired Claude rules directory"):
        return
    rule_files = sorted(
        path.relative_to(REPO_ROOT) for path in (REPO_ROOT / ".claude/rules").glob("*.md")
    )
    if rule_files:
        errors.append(f".claude/rules still contains markdown files: {rule_files}")


def main() -> int:
    SKIPPED_DEPARTURE_CHECKS.clear()
    errors: list[str] = []

    claude_permissions = load_claude_bash_permissions()
    codex_permissions = load_codex_prefix_rules()
    claude_all_patterns = load_claude_permission_patterns()
    kimi_allowed_patterns, kimi_denied_patterns = load_kimi_permission_patterns(errors)
    bash_rule = re.compile(r"Bash\((.+) \*\)")
    kimi_permissions = {
        match.group(1)
        for match in (bash_rule.fullmatch(p) for p in kimi_allowed_patterns)
        if match
    }

    only_in_claude = sorted(claude_permissions - codex_permissions)
    only_in_codex = sorted(codex_permissions - claude_permissions)
    skip_claude_codex_command_parity = skip_if_any_path_departed(
        (".claude/settings.json.example", ".codex/rules/default.rules"),
        "Claude and Codex command-family permission parity",
    )

    if only_in_claude and not skip_claude_codex_command_parity:
        errors.append(f"Commands allowed only in Claude config: {only_in_claude}")
    if only_in_codex and not skip_claude_codex_command_parity:
        errors.append(f"Commands allowed only in Codex config: {only_in_codex}")

    only_in_kimi = sorted(kimi_permissions - claude_permissions - codex_permissions)
    missing_in_kimi = sorted((claude_permissions | codex_permissions) - kimi_permissions)
    skip_kimi_command_parity = skip_if_any_path_departed(
        (
            ".claude/settings.json.example",
            ".codex/rules/default.rules",
            ".kimi-code/config.toml.example",
        ),
        "Kimi command-family permission parity",
    )

    if only_in_kimi and not skip_kimi_command_parity:
        errors.append(f"Commands allowed only in Kimi config: {only_in_kimi}")
    if missing_in_kimi and not skip_kimi_command_parity:
        errors.append(f"Commands missing from Kimi config: {missing_in_kimi}")

    only_in_claude_patterns = sorted(claude_all_patterns - kimi_allowed_patterns)
    only_in_kimi_patterns = sorted(kimi_allowed_patterns - claude_all_patterns)
    denied_in_kimi = sorted(kimi_denied_patterns & claude_all_patterns)
    skip_full_permission_parity = skip_if_any_path_departed(
        (".claude/settings.json.example", ".kimi-code/config.toml.example"),
        "Claude and Kimi full permission parity",
    )

    if only_in_claude_patterns and not skip_full_permission_parity:
        errors.append(
            f"Permissions allowed only in Claude config: {only_in_claude_patterns}"
        )
    if only_in_kimi_patterns and not skip_full_permission_parity:
        errors.append(
            f"Permissions allowed only in Kimi config: {only_in_kimi_patterns}"
        )
    if denied_in_kimi and not skip_full_permission_parity:
        errors.append(
            f"Permissions allowed in Claude but denied in Kimi config: {denied_in_kimi}"
        )

    protocol_names = collect_protocol_names()
    claude_skill_names = collect_skill_names(REPO_ROOT / ".claude/skills")
    codex_skill_names = collect_skill_names(REPO_ROOT / ".agents/skills")

    protocol_only = []
    for name in sorted(protocol_names - claude_skill_names - codex_skill_names):
        if not skip_departed_check(
            f"protocols/skills/{name}.md",
            "shared skill inventory",
        ):
            protocol_only.append(name)

    claude_only = []
    for name in sorted(claude_skill_names - protocol_names):
        if not skip_departed_check(
            f".claude/skills/{name}/SKILL.md",
            "Claude skill inventory",
        ):
            claude_only.append(name)

    codex_only = []
    for name in sorted(codex_skill_names - protocol_names):
        if not skip_departed_check(
            f".agents/skills/{name}/SKILL.md",
            "Codex skill inventory",
        ):
            codex_only.append(name)

    wrapper_mismatch = []
    for name in sorted(claude_skill_names ^ codex_skill_names):
        skip_wrapper_check = skip_if_any_path_departed(
            (
                f".claude/skills/{name}/SKILL.md",
                f".agents/skills/{name}/SKILL.md",
            ),
            "Claude and Codex skill wrapper inventory",
        )
        if not skip_wrapper_check:
            wrapper_mismatch.append(name)

    if protocol_only:
        errors.append(f"Protocol files without matching skill wrappers: {protocol_only}")
    if claude_only:
        errors.append(f"Claude skill wrappers without matching protocols: {claude_only}")
    if codex_only:
        errors.append(f"Codex skill wrappers without matching protocols: {codex_only}")
    if wrapper_mismatch:
        errors.append(f"Skill wrapper mismatch between Claude and Codex: {wrapper_mismatch}")

    check_wrapper_protocol_refs(REPO_ROOT / ".claude/skills", errors)
    check_wrapper_protocol_refs(REPO_ROOT / ".agents/skills", errors)
    check_agent_protocol_refs(errors)
    check_review_skill_agent_scope(errors)
    check_code_convention_routes(errors)
    check_claude_project_defaults(errors)
    check_workflow_policy(errors)
    check_commit_protocol_branch_policy(errors)
    check_protocol_required_snippets(errors)
    check_path_model_snippets(errors)
    check_claude_wrappers(errors)
    check_writing_guide(errors)
    check_no_legacy_rule_refs(errors)
    check_claude_rules_dir(errors)

    if errors:
        print("Template consistency check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Template consistency check passed.")
    print(f"- Shared protocols: {len(protocol_names)}")
    print(f"- Claude skill wrappers: {len(claude_skill_names)}")
    print(f"- Codex skill wrappers: {len(codex_skill_names)}")
    print(f"- Reviewed agent mappings: {len(REVIEW_AGENT_PROTOCOLS)}")
    permission_checks_skipped = (
        skip_claude_codex_command_parity
        or skip_kimi_command_parity
        or skip_full_permission_parity
    )
    if permission_checks_skipped:
        print(
            f"- Allowed command families: {len(claude_permissions)} "
            "(one or more parity checks skipped for a declared departure)"
        )
    else:
        print(
            f"- Allowed command families: {len(claude_permissions)} "
            "(Claude/Codex/Kimi in parity)"
        )
    if SKIPPED_DEPARTURE_CHECKS:
        print(
            "- Checks skipped for declared departures: "
            f"{len(SKIPPED_DEPARTURE_CHECKS)}"
        )
        for relative_path, check_name, reason in sorted(SKIPPED_DEPARTURE_CHECKS):
            print(f"  - {relative_path} [{check_name}]: {reason}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
