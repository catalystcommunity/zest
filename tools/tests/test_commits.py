import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from zest_tools import commits, release
from zest_tools.commands import ToolFailed, run
from zest_tools.commits import Commit


class SubjectTests(unittest.TestCase):
    def effect(self, subject, body=""):
        return Commit("hash", subject, body).effect

    def test_a_feature_is_minor_and_a_fix_is_patch(self):
        self.assertEqual(self.effect("feat: add it"), "minor")
        self.assertEqual(self.effect("fix(menu-item): repair it"), "patch")

    def test_a_breaking_change_is_major(self):
        self.assertEqual(self.effect("fix!: change it"), "major")
        self.assertEqual(self.effect("chore: change it", "BREAKING CHANGE: it moved"), "major")

    def test_these_are_accepted_and_release_nothing(self):
        for kind in ("chore", "docs", "test", "ci", "build", "refactor", "style", "norelease"):
            self.assertEqual(self.effect(f"{kind}: something"), "no release", kind)

    def test_these_are_refused(self):
        for subject in ("Update stuff", "fix:no space", "wibble: not a type", "feat(a): ", "FEAT: loud"):
            self.assertFalse(Commit("hash", subject).conventional, subject)

    def test_semver_tags_gets_the_same_lists_that_the_gate_uses(self):
        arguments = release.semver_tags_arguments()
        given = [arguments[i + 1] for i, part in enumerate(arguments) if part == "--patch_types"]
        self.assertEqual(given, list(commits.PATCH_TYPES))
        given = [arguments[i + 1] for i, part in enumerate(arguments) if part == "--minor_types"]
        self.assertEqual(given, list(commits.MINOR_TYPES))


class GateTests(unittest.TestCase):
    """The gate against real commits, because a job with none to read proves nothing."""

    def setUp(self):
        # A Reactorcide job has its own base, which is not a commit in this repository
        environment = mock.patch.dict("os.environ")
        environment.start()
        self.addCleanup(environment.stop)
        os.environ.pop("REACTORCIDE_DIFF_BASE", None)
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.git("init", "--initial-branch=main")
        self.git("config", "user.email", "test@example.com")
        self.git("config", "user.name", "Test")
        self.commit("chore: start")
        self.base = self.git("rev-parse", "HEAD").strip()
        real_run = run

        def run_here(command, **options):
            return real_run(command, **{**options, "cwd": self.root})

        patcher = mock.patch.object(commits, "run", run_here)
        patcher.start()
        self.addCleanup(patcher.stop)

    def git(self, *arguments):
        return subprocess.run(["git", *arguments], cwd=self.root, check=True, capture_output=True, text=True).stdout

    def commit(self, subject, body=""):
        message = ["--message", subject] + (["--message", body] if body else [])
        self.git("commit", "--allow-empty", *message)

    def test_passes_conventional_commits(self):
        self.commit("feat: add it", "A body.\n\nWith a blank line.")
        self.commit("fix(menu-item)!: change it")
        commits.check(self.base)
        found = commits.read_commits(self.base)
        self.assertEqual([commit.effect for commit in found], ["major", "minor"])

    def test_refuses_one_bad_commit_among_good_ones(self):
        self.commit("feat: add it")
        self.commit("Fixed the thing")
        with self.assertRaisesRegex(ToolFailed, "1 of 2"):
            commits.check(self.base)

    def test_finds_the_merge_base_by_itself(self):
        self.git("checkout", "-b", "work")
        self.commit("Bad subject")
        with self.assertRaisesRegex(ToolFailed, "1 of 1"):
            commits.check()

    def test_reads_the_base_that_reactorcide_gives(self):
        self.commit("Bad subject")
        with mock.patch.dict("os.environ", {"REACTORCIDE_DIFF_BASE": self.base}):
            with self.assertRaisesRegex(ToolFailed, "1 of 1"):
                commits.check()


if __name__ == "__main__":
    unittest.main()
