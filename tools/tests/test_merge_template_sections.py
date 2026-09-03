#!/usr/bin/env python3
"""Tests for byte-preserving root instruction merges.

The examples combine shared sections with project facts, missing sections, a
project manuscript location, and retired replication instructions.

Run with: python3 -m unittest tools.tests.test_merge_template_sections
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "tools"))

import merge_template_sections  # noqa: E402


def initialize_git_repository(repository: Path) -> None:
    """Create a repository on a named branch for branch-report tests."""

    repository.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["git", "init", "-q", "-b", "section-test-branch", str(repository)],
        check=True,
        capture_output=True,
    )


def section_by_title(contents: bytes, title: str) -> bytes:
    """Return the exact bytes of one `##` section."""

    _, sections = merge_template_sections.parse_sections(contents)
    return next(section.contents for section in sections if section.title == title)


class TemplateSectionMergeTests(unittest.TestCase):
    """Only template-owned root sections should be replaced or inserted."""

    def setUp(self) -> None:
        self.workspace = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.workspace, True)
        self.target = self.workspace / "research-project"
        initialize_git_repository(self.target)

    def build_hybrid_documents(self) -> tuple[bytes, bytes, bytes, bytes]:
        """Write project documents with all merge cases represented."""

        template_agents = (REPO_ROOT / "AGENTS.md").read_bytes()
        template_claude = (REPO_ROOT / "CLAUDE.md").read_bytes()

        agents_preamble, _ = merge_template_sections.parse_sections(template_agents)
        claude_preamble, _ = merge_template_sections.parse_sections(template_claude)

        project_core = (
            b"## Core Principles\n\n"
            b"- **Match process to risk** -- earlier wording\n"
            b"- **Single source of truth** -- the manuscript in `$MANUSCRIPT_DIR` "
            b"is\n"
            b"  authoritative for the paper and appendix\n"
            b"- **Project rule** -- retain the empirical appendix instructions\n\n"
            b"---\n\n"
        )
        project_agents_section = (
            b"## Manuscript Location\n\n"
            b"The manuscript stays in the coauthor's Overleaf checkout.\n\n"
            b"---\n\n"
        )
        project_folder_section = (
            b"## Folder Structure\n\n"
            b"Project-owned folder description with exact spacing.  \n\n"
            b"---\n\n"
        )
        earlier_quality = (
            b"## Quality Thresholds\n\n"
            b"Earlier shared thresholds.\n\n"
            b"---\n\n"
        )
        project_agents_commands = (
            b"## Commands\n\n"
            b"Project introduction that the shared path guidance replaces.\n\n"
            b"```bash\n"
            b"make project-agents-target\n"
            b"```\n\n"
            b"---\n\n"
        )
        project_claude_commands = (
            b"## Commands\n\n"
            b"```bash\n"
            b"make project-claude-target\n"
            b"```\n\n"
            b"---\n\n"
        )
        retired_replication = (
            b"## Replication-First Protocol\n\n"
            b"Retired instructions.\n\n"
            b"### Summary\n\n"
            b"A retired summary instruction.\n\n"
            b"## Replication Targets: [Paper Author (Year)]\n\n"
            b"Unfilled table.\n\n"
            b"## Results Comparison\n\n"
            b"Retired comparison.\n\n"
            b"## Discrepancies (if any)\n\n"
            b"Retired discrepancy notes.\n\n"
            b"## Environment\n\n"
            b"Retired environment notes.\n\n"
        )

        agents_core = section_by_title(template_agents, "Core Principles")
        agents_folder = section_by_title(template_agents, "Folder Structure")
        agents_commands = section_by_title(template_agents, "Commands")
        agents_quality = section_by_title(template_agents, "Quality Thresholds")
        general_trace = section_by_title(template_agents, "General Trace Protocol")
        target_agents = template_agents.replace(
            agents_core,
            project_core + project_agents_section,
            1,
        )
        target_agents = target_agents.replace(agents_folder, project_folder_section, 1)
        target_agents = target_agents.replace(agents_commands, project_agents_commands, 1)
        target_agents = target_agents.replace(agents_quality, earlier_quality, 1)
        target_agents = target_agents.replace(
            general_trace,
            retired_replication + general_trace,
            1,
        )

        project_claude_section = (
            b"## Git Authorization Boundary\n\n"
            b"A push instruction does not authorize a commit.\n\n"
        )
        claude_core = section_by_title(template_claude, "Core Principles")
        claude_commands = section_by_title(template_claude, "Commands")
        kimi_section = section_by_title(template_claude, "Kimi Code CLI")
        target_claude = template_claude.replace(
            claude_core,
            project_core + project_claude_section,
            1,
        ).replace(claude_commands, project_claude_commands, 1)
        target_claude = target_claude.replace(kimi_section, b"", 1)

        (self.target / "AGENTS.md").write_bytes(target_agents)
        (self.target / "CLAUDE.md").write_bytes(target_claude)
        return (
            agents_preamble,
            claude_preamble,
            project_agents_section,
            project_folder_section,
        )

    def test_commands_is_the_only_project_section_with_shared_fence_preamble(self) -> None:
        """No other project-owned fenced section needs a partial template merge."""

        for file_name, owned_titles in merge_template_sections.OWNED_SECTION_TITLES.items():
            contents = (REPO_ROOT / file_name).read_bytes()
            _, sections = merge_template_sections.parse_sections(contents)
            sections_with_opening_prose: list[str] = []
            for section in sections:
                if section.title in owned_titles:
                    continue
                fence = merge_template_sections.FENCED_BLOCK.search(section.contents)
                if fence is None:
                    continue
                heading_end = section.contents.find(b"\n") + 1
                opening_prose = section.contents[heading_end : fence.start()].strip()
                if opening_prose:
                    sections_with_opening_prose.append(section.title)

            self.assertEqual(sections_with_opening_prose, ["Commands"])

    def test_merge_replaces_inserts_preserves_removes_and_repeats_cleanly(self) -> None:
        (
            agents_preamble,
            claude_preamble,
            project_agents_section,
            project_folder_section,
        ) = self.build_hybrid_documents()

        first = merge_template_sections.merge_repository(
            REPO_ROOT,
            self.target,
            apply=True,
        )
        second = merge_template_sections.merge_repository(
            REPO_ROOT,
            self.target,
            apply=True,
        )

        merged_agents = (self.target / "AGENTS.md").read_bytes()
        merged_claude = (self.target / "CLAUDE.md").read_bytes()
        self.assertTrue(first.has_changes)
        self.assertFalse(second.has_changes)
        self.assertEqual(first.branch, "section-test-branch")
        self.assertEqual(
            merge_template_sections.parse_sections(merged_agents)[0],
            agents_preamble,
        )
        self.assertEqual(
            merge_template_sections.parse_sections(merged_claude)[0],
            claude_preamble,
        )
        self.assertEqual(
            section_by_title(merged_agents, "Manuscript Location"),
            project_agents_section,
        )
        self.assertEqual(
            section_by_title(merged_agents, "Folder Structure"),
            project_folder_section,
        )
        self.assertIn(
            b"the manuscript in `$MANUSCRIPT_DIR` is\n"
            b"  authoritative for the paper and appendix",
            section_by_title(merged_agents, "Core Principles"),
        )
        self.assertIn(
            b"the manuscript in `$MANUSCRIPT_DIR` is\n"
            b"  authoritative for the paper and appendix",
            section_by_title(merged_claude, "Core Principles"),
        )
        self.assertEqual(
            section_by_title(merged_agents, "Quality Thresholds"),
            section_by_title((REPO_ROOT / "AGENTS.md").read_bytes(), "Quality Thresholds"),
        )
        merged_agents_commands = section_by_title(merged_agents, "Commands")
        merged_claude_commands = section_by_title(merged_claude, "Commands")
        self.assertIn(
            b"Run all Make commands below from the repository root.",
            merged_agents_commands,
        )
        self.assertIn(
            b"`make -C path` changes Make's working directory",
            merged_agents_commands,
        )
        self.assertIn(b"make project-agents-target", merged_agents_commands)
        self.assertNotIn(b"make project-claude-target", merged_agents_commands)
        self.assertIn(
            b"Run all Make commands below from the repository root.",
            merged_claude_commands,
        )
        self.assertIn(
            b"`make -C path` changes Make's working directory",
            merged_claude_commands,
        )
        self.assertIn(b"make project-claude-target", merged_claude_commands)
        self.assertNotIn(b"make project-agents-target", merged_claude_commands)
        self.assertNotIn(
            b"Project introduction that the shared path guidance replaces.",
            merged_agents_commands,
        )
        self.assertIn("AGENTS.md: Commands", first.replaced_sections)
        self.assertIn("CLAUDE.md: Commands", first.replaced_sections)
        self.assertIn("CLAUDE.md: Kimi Code CLI", first.inserted_sections)
        self.assertLess(
            merged_claude.index(b"## Kimi Code CLI"),
            merged_claude.index(b"## Explicit Codex Handoff"),
        )
        self.assertNotIn(b"## Replication-First Protocol", merged_agents)
        self.assertNotIn(b"## Replication Targets: [Paper Author (Year)]", merged_agents)
        self.assertNotIn(b"## Results Comparison", merged_agents)
        self.assertTrue(
            any("Replication-First Protocol" in item for item in first.removed_sections)
        )
        self.assertTrue(any("### Summary" in item for item in first.removed_sections))

    def test_departed_root_file_is_neither_changed_nor_added(self) -> None:
        template_claude = (REPO_ROOT / "CLAUDE.md").read_bytes()
        custom_claude = template_claude.replace(
            section_by_title(template_claude, "Quality Thresholds"),
            b"## Quality Thresholds\n\nProject thresholds.\n\n",
            1,
        )
        (self.target / "CLAUDE.md").write_bytes(custom_claude)
        tools_directory = self.target / "tools"
        tools_directory.mkdir()
        (tools_directory / "template_departures.toml").write_text(
            "[[departure]]\n"
            'path = "AGENTS.md"\n'
            'reason = "The project manages this file elsewhere."\n\n'
            "[[departure]]\n"
            'path = "CLAUDE.md"\n'
            'reason = "The project keeps different root instructions."\n'
        )
        before_claude = (self.target / "CLAUDE.md").read_bytes()

        report = merge_template_sections.merge_repository(
            REPO_ROOT,
            self.target,
            apply=True,
        )

        self.assertFalse((self.target / "AGENTS.md").exists())
        self.assertEqual((self.target / "CLAUDE.md").read_bytes(), before_claude)
        self.assertFalse(report.has_changes)
        self.assertEqual(
            [item.path for item in report.departures_honored],
            ["AGENTS.md", "CLAUDE.md"],
        )

    def test_default_command_mode_is_dry_run(self) -> None:
        arguments = merge_template_sections.parse_arguments(
            ["--repo", str(self.target)]
        )

        self.assertFalse(arguments.apply)


if __name__ == "__main__":
    unittest.main()
