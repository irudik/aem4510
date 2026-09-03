#!/usr/bin/env python3
"""Tests for the optional-part declaration in check_template_consistency.py.

Repositories built from this template differ in structure. Some keep the
manuscript in an Overleaf checkout and have no `latex/` directory, some have no
`code/` directory, and most have a project README rather than the template's own
framework documentation. The checker is byte-identical everywhere; each
repository declares what it has in `tools/template_check.toml`.

These tests build small copies of the template on disk and run the checker
against them, so they exercise the real script rather than a stand-in.

Run with: python3 -m unittest discover -s tools/tests
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]

# A project README that documents the project, not the agent framework.
PROJECT_README = "# Some Project\n\nA short project README.\n"

DECLARES_NOTHING_OPTIONAL = (
    "has_latex = false\n"
    "has_code = false\n"
    "readme_documents_framework = false\n"
)

DECLARES_EVERYTHING = (
    "has_latex = true\n"
    "has_code = true\n"
    "readme_documents_framework = true\n"
)


# Everything the checker reads. Copying only these keeps the test fast and the
# same in a large project repository as in the template.
CHECKED_PATHS = (
    ".agents/",
    ".claude/",
    ".codex/",
    ".kimi-code/",
    "protocols/",
    "templates/",
    "tools/",
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
    "code/AGENTS.md",
    "code/CLAUDE.md",
    "latex/AGENTS.md",
    "latex/CLAUDE.md",
)


def tracked_files() -> list[str]:
    """Return the tracked files the checker reads in this repository."""
    listing = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "ls-files"],
        capture_output=True,
        text=True,
        check=True,
    )

    return [path for path in listing.stdout.split() if path.startswith(CHECKED_PATHS)]


def build_repo(destination: Path, *, omit_prefixes: tuple[str, ...]) -> None:
    """Copy this repository's checked files, leaving out the named directories."""
    for relative_path in tracked_files():
        if relative_path.startswith(omit_prefixes):
            continue

        target = destination / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(REPO_ROOT / relative_path, target)


def run_checker(repo: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(repo / "tools/check_template_consistency.py")],
        capture_output=True,
        text=True,
    )


def add_session_logging_reference(repo: Path) -> None:
    """Add the retired hook and its reference to the settings example."""

    hook_path = repo / ".claude/hooks/log-reminder.py"
    hook_path.parent.mkdir(parents=True, exist_ok=True)
    hook_path.write_text("# Project session reminder.\n")

    settings_path = repo / ".claude/settings.json.example"
    settings = json.loads(settings_path.read_text())
    settings["hooks"] = {
        "Stop": [
            {
                "command": "python3 .claude/hooks/log-reminder.py",
            }
        ]
    }
    settings_path.write_text(json.dumps(settings, indent=2) + "\n")


class SurfaceDeclarationTests(unittest.TestCase):
    """The checker should apply exactly the checks a repository's structure warrants."""

    def setUp(self) -> None:
        self.workspace = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.workspace, True)

    def build_overleaf_style_repo(self, declaration: str) -> Path:
        """Build a repo with no latex/, no code/, and a project README."""
        repo = self.workspace / "project"
        build_repo(repo, omit_prefixes=("latex/", "code/", "README.md"))
        (repo / "README.md").write_text(PROJECT_README)
        (repo / "tools/template_check.toml").write_text(declaration)

        return repo

    def test_declared_absent_parts_are_not_required(self) -> None:
        repo = self.build_overleaf_style_repo(DECLARES_NOTHING_OPTIONAL)

        result = run_checker(repo)

        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("check passed", result.stdout)

    def test_declared_present_parts_are_still_required(self) -> None:
        """A wrong declaration must not hide a genuinely missing file."""
        repo = self.build_overleaf_style_repo(DECLARES_EVERYTHING)

        result = run_checker(repo)

        self.assertEqual(result.returncode, 1)
        self.assertIn("latex/AGENTS.md is missing", result.stdout)
        self.assertIn("code/AGENTS.md is missing", result.stdout)
        self.assertIn("README.md is missing workflow policy text", result.stdout)

    def test_missing_declaration_requires_the_whole_template(self) -> None:
        """Without a declaration, every part of the template is required."""
        repo = self.build_overleaf_style_repo(DECLARES_NOTHING_OPTIONAL)
        (repo / "tools/template_check.toml").unlink()

        result = run_checker(repo)

        self.assertEqual(result.returncode, 1)
        self.assertIn("latex/AGENTS.md is missing", result.stdout)

    def test_obsolete_text_is_caught_in_a_project_readme(self) -> None:
        """Declaring a project README must not stop checks for retired rules."""
        repo = self.build_overleaf_style_repo(DECLARES_NOTHING_OPTIONAL)
        (repo / "README.md").write_text(
            "# Some Project\n\n"
            "We run the orchestrator in Contractor Mode and follow "
            ".claude/rules/quality-gates.md.\n"
        )

        result = run_checker(repo)

        self.assertEqual(result.returncode, 1)
        self.assertIn("contains obsolete workflow text", result.stdout)
        self.assertIn("references deleted .claude/rules content", result.stdout)

    def test_untracked_local_settings_may_hold_machine_defaults(self) -> None:
        """A machine-local settings file is not a tracked project choice."""

        repo = self.build_overleaf_style_repo(DECLARES_NOTHING_OPTIONAL)
        (repo / ".claude/settings.json").write_text(
            '{"effortLevel": "max", "model": "local-choice"}\n'
        )

        result = run_checker(repo)

        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("check passed", result.stdout)

    def test_tracked_local_settings_may_not_pin_project_defaults(self) -> None:
        """The same settings become project policy when Git records the file."""

        repo = self.build_overleaf_style_repo(DECLARES_NOTHING_OPTIONAL)
        settings_path = repo / ".claude/settings.json"
        settings_path.write_text('{"effortLevel": "max"}\n')
        subprocess.run(
            ["git", "init", "-q", str(repo)],
            check=True,
            capture_output=True,
        )
        subprocess.run(
            ["git", "-C", str(repo), "add", ".claude/settings.json"],
            check=True,
            capture_output=True,
        )

        result = run_checker(repo)

        self.assertEqual(result.returncode, 1)
        self.assertIn(".claude/settings.json pins Claude effortLevel", result.stdout)

    def test_settings_example_is_checked_without_git_tracking(self) -> None:
        """The shared example remains project policy even outside a Git test copy."""

        repo = self.build_overleaf_style_repo(DECLARES_NOTHING_OPTIONAL)
        settings_path = repo / ".claude/settings.json.example"
        settings = json.loads(settings_path.read_text())
        settings["effortLevel"] = "max"
        settings_path.write_text(json.dumps(settings, indent=2) + "\n")

        result = run_checker(repo)

        self.assertEqual(result.returncode, 1)
        self.assertIn(
            ".claude/settings.json.example pins Claude effortLevel",
            result.stdout,
        )

    def test_declared_departures_skip_and_report_only_their_checks(self) -> None:
        repo = self.build_overleaf_style_repo(DECLARES_NOTHING_OPTIONAL)
        add_session_logging_reference(repo)
        (repo / "tools/template_departures.toml").write_text(
            "[[departure]]\n"
            'path = ".claude/settings.json.example"\n'
            'reason = "This project keeps its Stop hook."\n\n'
            "[[departure]]\n"
            'path = ".claude/hooks/*.py"\n'
            'reason = "This project keeps session reminders."\n'
        )

        result = run_checker(repo)

        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("check passed", result.stdout)
        self.assertIn("Checks skipped for declared departures", result.stdout)
        self.assertIn(
            ".claude/settings.json.example [retired workflow policy]: "
            "This project keeps its Stop hook.",
            result.stdout,
        )
        self.assertIn(
            ".claude/hooks/log-reminder.py [retired session-logging hook]: "
            "This project keeps session reminders.",
            result.stdout,
        )

    def test_same_session_logging_files_fail_without_departures(self) -> None:
        """Without a departure, both retired session-logging checks stay strict."""

        repo = self.build_overleaf_style_repo(DECLARES_NOTHING_OPTIONAL)
        add_session_logging_reference(repo)

        result = run_checker(repo)

        self.assertEqual(result.returncode, 1)
        self.assertIn(
            ".claude/settings.json.example contains obsolete workflow text",
            result.stdout,
        )
        self.assertIn(
            ".claude/hooks/log-reminder.py still enforces mandatory session logging",
            result.stdout,
        )

    def test_convention_departure_does_not_relax_undeclared_repository(self) -> None:
        """A path glob excuses its files, and removing it restores strict checks."""

        repo = self.build_overleaf_style_repo(DECLARES_NOTHING_OPTIONAL)
        (repo / "protocols/conventions/r.md").write_text(
            "# Project-specific R convention\n"
        )
        departure_path = repo / "tools/template_departures.toml"
        departure_path.write_text(
            "[[departure]]\n"
            'path = "protocols/conventions/*.md"\n'
            'reason = "This project uses root-relative analysis paths."\n'
        )

        departed_result = run_checker(repo)
        departure_path.unlink()
        strict_result = run_checker(repo)

        self.assertEqual(departed_result.returncode, 0, departed_result.stdout)
        self.assertIn(
            "protocols/conventions/r.md [required path model]: "
            "This project uses root-relative analysis paths.",
            departed_result.stdout,
        )
        self.assertEqual(strict_result.returncode, 1)
        self.assertIn(
            "protocols/conventions/r.md is missing required path-model text",
            strict_result.stdout,
        )

    def test_this_repository_passes(self) -> None:
        """The checker agrees with this repository's own declaration."""
        result = run_checker(REPO_ROOT)

        self.assertEqual(result.returncode, 0, result.stdout)


if __name__ == "__main__":
    unittest.main()
