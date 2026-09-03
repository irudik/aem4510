#!/usr/bin/env python3
"""Tests for bounded, repeatable template propagation.

The tests use small Git repositories on disk so copying, index removal,
symlink safety, and target-owned departures are exercised together.

Run with: python3 -m unittest tools.tests.test_sync_template
"""

from __future__ import annotations

import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "tools"))

import sync_template  # noqa: E402


def write_file(repository: Path, relative_path: str, contents: str) -> Path:
    """Write one example file and return its path."""

    path = repository / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contents)
    return path


def initialize_git_repository(repository: Path, branch: str = "test-branch") -> None:
    """Create a Git index so the test uses the same path rules as a project."""

    repository.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["git", "init", "-q", "-b", branch, str(repository)],
        check=True,
        capture_output=True,
    )


def add_all(repository: Path) -> None:
    """Record the current example files in Git without creating a commit."""

    subprocess.run(
        ["git", "-C", str(repository), "add", "-A"],
        check=True,
        capture_output=True,
    )


def indexed_paths(repository: Path) -> set[str]:
    """Return the paths still recorded in the example repository."""

    result = subprocess.run(
        ["git", "-C", str(repository), "ls-files"],
        check=True,
        capture_output=True,
        text=True,
    )
    return set(result.stdout.splitlines())


def working_tree_state(repository: Path) -> dict[str, tuple[object, ...]]:
    """Describe files and symlinks without following linked directories."""

    state: dict[str, tuple[object, ...]] = {}
    for current_root, directory_names, file_names in os.walk(
        repository,
        topdown=True,
        followlinks=False,
    ):
        current = Path(current_root)
        if current == repository:
            directory_names[:] = [name for name in directory_names if name != ".git"]

        symlink_directories = [
            name for name in directory_names if (current / name).is_symlink()
        ]
        directory_names[:] = [
            name for name in directory_names if name not in symlink_directories
        ]
        for name in symlink_directories:
            path = current / name
            relative_path = path.relative_to(repository).as_posix()
            state[relative_path] = ("symlink", os.readlink(path))
        for name in file_names:
            path = current / name
            relative_path = path.relative_to(repository).as_posix()
            if path.is_symlink():
                state[relative_path] = ("symlink", os.readlink(path))
            else:
                mode = stat.S_IMODE(path.stat().st_mode)
                state[relative_path] = ("file", path.read_bytes(), mode)
    return state


class TemplateSyncTests(unittest.TestCase):
    """The command should change only the named shared framework paths."""

    def setUp(self) -> None:
        self.workspace = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.workspace, True)
        self.template = self.workspace / "repo-template"
        initialize_git_repository(self.template, "template-branch")

        write_file(self.template, ".codex/config.toml", "# template config\n")
        notify = write_file(
            self.template,
            ".claude/hooks/notify.sh",
            "#!/bin/sh\nexit 0\n",
        )
        notify.chmod(0o755)
        write_file(
            self.template,
            ".github/workflows/copilot-review.yml",
            "name: review\n",
        )
        write_file(
            self.template,
            "protocols/conventions/shared.md",
            "# Shared convention\n",
        )
        write_file(
            self.template,
            "protocols/conventions/r.md",
            "# R convention\n",
        )
        write_file(
            self.template,
            "protocols/conventions/matlab.md",
            "# MATLAB convention\n",
        )
        write_file(self.template, "tools/check_template_consistency.py", "# check\n")
        write_file(self.template, "tools/template_check.toml", "do_not_copy = true\n")
        write_file(
            self.template,
            "tools/template_departures.toml",
            "# A target-owned file must never be copied.\n",
        )
        write_file(self.template, "code/AGENTS.md", "# Code instructions\n")
        write_file(self.template, "latex/AGENTS.md", "# Latex instructions\n")
        write_file(self.template, "AGENTS.md", "# Root instructions\n")
        add_all(self.template)

    def build_target(self, name: str = "research-project") -> Path:
        """Create an empty research repository on a known branch."""

        target = self.workspace / name
        initialize_git_repository(target, "current-research-branch")
        write_file(target, "CLAUDE.md", "# Project instructions\n")
        add_all(target)
        return target

    def test_dry_run_changes_nothing_on_disk_or_in_git(self) -> None:
        target = self.build_target()
        (target / "code").mkdir()
        write_file(target, "code/AGENTS.md", "# Earlier code instructions\n")
        add_all(target)
        before_files = working_tree_state(target)
        before_index = indexed_paths(target)

        report = sync_template.sync_repository(self.template, target, apply=False)

        self.assertTrue(report.has_changes)
        self.assertEqual(report.branch, "current-research-branch")
        self.assertEqual(working_tree_state(target), before_files)
        self.assertEqual(indexed_paths(target), before_index)

    def test_apply_is_repeatable_and_respects_missing_directories(self) -> None:
        target = self.build_target()
        (target / "code").mkdir()

        first = sync_template.sync_repository(self.template, target, apply=True)
        second = sync_template.sync_repository(self.template, target, apply=True)

        self.assertTrue(first.has_changes)
        self.assertFalse(second.has_changes)
        self.assertEqual(
            (target / ".codex/config.toml").read_text(),
            "# template config\n",
        )
        self.assertEqual(
            (target / "code/AGENTS.md").read_text(),
            "# Code instructions\n",
        )
        self.assertFalse((target / "latex").exists())
        self.assertFalse((target / "tools/template_departures.toml").exists())
        declaration = (target / "tools/template_check.toml").read_text()
        self.assertIn("has_latex = false", declaration)
        self.assertIn("has_code = true", declaration)
        self.assertIn("readme_documents_framework = false", declaration)

    def test_target_without_code_or_latex_never_gains_either(self) -> None:
        target = self.build_target("enviro-transport")

        sync_template.sync_repository(self.template, target, apply=True)

        self.assertFalse((target / "code").exists())
        self.assertFalse((target / "latex").exists())

    def test_preserved_file_survives_and_retired_files_are_removed(self) -> None:
        write_file(self.template, "tools/project_calculation.jl", "template value\n")
        add_all(self.template)
        target = self.build_target("simple-reallocation")
        write_file(target, "tools/project_calculation.jl", "project value\n")
        write_file(target, ".claude/rules/old-rule.md", "retired\n")
        write_file(target, ".claude/hooks/log-reminder.py", "retired\n")
        write_file(target, ".claude/WORKFLOW_QUICK_REF.md", "retired\n")
        write_file(target, ".claude/agents/verifier.md", "retired\n")
        write_file(target, ".claude/.headroom_wrap_marker.json", "{}\n")
        write_file(target, ".codex/agents/old.toml", "retired = true\n")
        write_file(target, ".codex/hooks/old.json", "{}\n")
        write_file(target, ".codex/hooks.json", "{}\n")
        write_file(target, ".claude/settings.json", "{}\n")
        write_file(target, "tools/__pycache__/old.pyc", "compiled\n")
        add_all(target)

        report = sync_template.sync_repository(self.template, target, apply=True)
        second = sync_template.sync_repository(self.template, target, apply=True)

        self.assertEqual(
            (target / "tools/project_calculation.jl").read_text(),
            "project value\n",
        )
        self.assertTrue(any(item.path.endswith(".jl") for item in report.preserved))
        self.assertFalse((target / ".claude/rules").exists())
        self.assertFalse((target / ".claude/hooks/log-reminder.py").exists())
        self.assertFalse((target / ".claude/WORKFLOW_QUICK_REF.md").exists())
        self.assertFalse((target / ".claude/agents/verifier.md").exists())
        self.assertFalse((target / ".claude/.headroom_wrap_marker.json").exists())
        self.assertFalse((target / ".codex/agents/old.toml").exists())
        self.assertFalse((target / ".codex/agents").exists())
        self.assertFalse((target / ".codex/hooks").exists())
        self.assertFalse((target / ".codex/hooks.json").exists())
        self.assertTrue((target / ".claude/settings.json").exists())
        self.assertTrue((target / "tools/__pycache__/old.pyc").exists())
        remaining_index = indexed_paths(target)
        self.assertNotIn(".claude/settings.json", remaining_index)
        self.assertNotIn("tools/__pycache__/old.pyc", remaining_index)
        self.assertFalse(second.has_changes)

    def test_retired_agents_directory_remains_when_it_has_another_file(self) -> None:
        target = self.build_target("agents-with-project-file")
        write_file(target, ".codex/agents/old.toml", "retired = true\n")
        write_file(target, ".codex/agents/project-note.md", "Keep this file.\n")
        add_all(target)

        report = sync_template.sync_repository(self.template, target, apply=True)
        second = sync_template.sync_repository(self.template, target, apply=True)

        self.assertFalse((target / ".codex/agents/old.toml").exists())
        self.assertEqual(
            (target / ".codex/agents/project-note.md").read_text(),
            "Keep this file.\n",
        )
        self.assertTrue((target / ".codex/agents").is_dir())
        self.assertNotIn(".codex/agents", report.deleted)
        self.assertFalse(second.has_changes)

    def test_already_empty_retired_agents_directory_is_removed(self) -> None:
        target = self.build_target("empty-agents-directory")
        (target / ".codex/agents").mkdir(parents=True)

        report = sync_template.sync_repository(self.template, target, apply=True)
        second = sync_template.sync_repository(self.template, target, apply=True)

        self.assertFalse((target / ".codex/agents").exists())
        self.assertIn(".codex/agents", report.deleted)
        self.assertFalse(second.has_changes)

    def test_data_and_output_symlinks_are_never_followed_or_written(self) -> None:
        target = self.build_target("linked-project")
        external_data = self.workspace / "external-data"
        external_output = self.workspace / "external-output"
        external_data.mkdir()
        external_output.mkdir()
        write_file(external_data, "sentinel.txt", "data unchanged\n")
        write_file(external_output, "sentinel.txt", "output unchanged\n")
        (target / "data").symlink_to(external_data, target_is_directory=True)
        (target / "output").symlink_to(external_output, target_is_directory=True)
        before_data = working_tree_state(external_data)
        before_output = working_tree_state(external_output)

        sync_template.sync_repository(self.template, target, apply=True)

        self.assertTrue((target / "data").is_symlink())
        self.assertTrue((target / "output").is_symlink())
        self.assertEqual(working_tree_state(external_data), before_data)
        self.assertEqual(working_tree_state(external_output), before_output)

    def test_target_departures_apply_to_copy_delete_generate_and_globs(self) -> None:
        target = self.build_target("departed-project")
        write_file(target, ".codex/config.toml", "# project config\n")
        write_file(target, ".claude/hooks/log-reminder.py", "# keep this hook\n")
        write_file(
            target,
            "protocols/conventions/r.md",
            "# Project R convention\n",
        )
        write_file(
            target,
            "protocols/conventions/matlab.md",
            "# Project MATLAB convention\n",
        )
        departure_path = write_file(
            target,
            "tools/template_departures.toml",
            "[[departure]]\n"
            'path = ".codex/config.toml"\n'
            'reason = "Project configuration."\n\n'
            "[[departure]]\n"
            'path = ".claude/hooks/log-reminder.py"\n'
            'reason = "Project keeps session reminders."\n\n'
            "[[departure]]\n"
            'path = ".github/workflows/copilot-review.yml"\n'
            'reason = "Project does not add this workflow."\n\n'
            "[[departure]]\n"
            'path = "protocols/conventions/*.md"\n'
            'reason = "Project language conventions."\n\n'
            "[[departure]]\n"
            'path = "tools/template_check.toml"\n'
            'reason = "Project manages its own declaration."\n\n'
            "[[departure]]\n"
            'path = "nowhere/*.md"\n'
            'reason = "Renamed path needing review."\n',
        )
        departure_contents = departure_path.read_bytes()
        add_all(target)

        report = sync_template.sync_repository(self.template, target, apply=True)

        self.assertEqual((target / ".codex/config.toml").read_text(), "# project config\n")
        self.assertTrue((target / ".claude/hooks/log-reminder.py").exists())
        self.assertFalse((target / ".github/workflows/copilot-review.yml").exists())
        self.assertEqual(
            (target / "protocols/conventions/r.md").read_text(),
            "# Project R convention\n",
        )
        self.assertEqual(
            (target / "protocols/conventions/matlab.md").read_text(),
            "# Project MATLAB convention\n",
        )
        self.assertFalse((target / "tools/template_check.toml").exists())
        self.assertEqual(departure_path.read_bytes(), departure_contents)
        honored_paths = [item.path for item in report.departures_honored]
        self.assertIn(".codex/config.toml", honored_paths)
        self.assertIn(".claude/hooks/log-reminder.py", honored_paths)
        self.assertIn(".github/workflows/copilot-review.yml", honored_paths)
        self.assertIn("protocols/conventions/r.md", honored_paths)
        self.assertIn("protocols/conventions/matlab.md", honored_paths)
        self.assertIn("tools/template_check.toml", honored_paths)
        self.assertEqual(len(report.warnings), 1)
        self.assertIn("nowhere/*.md", report.warnings[0])
        self.assertIn(".claude/hooks/log-reminder.py", indexed_paths(target))

    def test_default_command_mode_is_dry_run(self) -> None:
        arguments = sync_template.parse_arguments(["--repo", str(self.workspace)])

        self.assertFalse(arguments.apply)


if __name__ == "__main__":
    unittest.main()
