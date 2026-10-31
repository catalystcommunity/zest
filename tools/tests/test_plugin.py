"""The release job cannot run under `run-local`, because it holds secrets. This drives the
real plugin against a local bare remote, with a fake `npm` for the publish commands only.
The real npm still stamps and packs."""

import importlib.util
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

from zest_tools import deps
from zest_tools.commands import REPOSITORY_ROOT

from .test_release import git, git_output, write_package

TOKEN = "npm_sekret_value_for_the_test"
PAT = "ghp_sekret_value_for_the_test"

FAKE_NPM = """#!/bin/sh
echo "$*" >> "$FAKE_NPM_LOG"
case "$1 $2" in
  "view @scope/beta") [ -z "$FAKE_NPM_MISSING_BETA" ] || exit 1; echo 0.2.0 ;;
  "stage publish")
    case "$*" in
      *--dry-run*) ;;
      *beta*) [ -z "$FAKE_NPM_FAIL_BETA" ] || exit 1 ;;
    esac ;;
esac
exit 0
"""


def load_plugin(log_lines):
    """Load the real plugin with stand-ins for what the runner image provides."""
    source = types.ModuleType("src")
    logging = types.ModuleType("src.logging")
    logging.log_stdout = log_lines.append
    plugins = types.ModuleType("src.plugins")
    plugins.Plugin = object
    plugins.PluginContext = object
    plugins.PluginPhase = types.SimpleNamespace(POST_SOURCE_PREP="post_source_prep")
    with mock.patch.dict(sys.modules, {"src": source, "src.logging": logging, "src.plugins": plugins}):
        path = REPOSITORY_ROOT / ".reactorcide" / "plugins" / "plugin_zest_jobs.py"
        spec = importlib.util.spec_from_file_location("plugin_zest_jobs_under_test", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module


class ReleaseJobTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.home = self.base / "home"
        self.home.mkdir()
        self.remote = self.base / "remote.git"
        self.root = self.base / "work"
        subprocess.run(["git", "init", "--bare", "--initial-branch=main", self.remote], check=True, capture_output=True)
        subprocess.run(["git", "clone", self.remote, self.root], check=True, capture_output=True)
        git(self.root, "checkout", "-b", "main")
        git(self.root, "config", "user.email", "test@example.com")
        git(self.root, "config", "user.name", "Test")
        write_package(self.root, "packages/alpha", "@scope/alpha", "0.1.0")
        write_package(self.root, "packages/beta", "@scope/beta", "0.2.0", {"@scope/alpha": ">=0.1.0 <1.0.0"})
        (self.root / "src").mkdir()
        (self.root / "src" / "index.js").write_text("export * from '@scope/alpha';\n")
        (self.root / "package.json").write_text(json.dumps({
            "name": "@scope/umbrella", "version": "0.3.3", "main": "src/index.js", "files": ["src/index.js"],
            "workspaces": ["packages/*"], "dependencies": {"@scope/alpha": ">=0.1.0 <1.0.0"},
        }, indent=2) + "\n")
        (self.root / ".gitignore").write_text("node_modules\n.deps\ntools\ndist-release\n")
        git(self.root, "add", "--all")
        git(self.root, "commit", "--message", "chore: start")
        for tag in ("alpha/v0.1.0", "beta/v0.2.0", "zest/v0.3.3"):
            git(self.root, "tag", tag)
        git(self.root, "push", "origin", "main", "--tags")

        # The job runs the tools from its own checkout, and shares the pinned downloads
        shutil.copytree(REPOSITORY_ROOT / "tools", self.root / "tools", ignore=shutil.ignore_patterns("__pycache__", "tests"))
        deps.fetch_all()
        (self.root / ".deps").symlink_to(deps.DEPENDENCY_DIR)

        self.npm_log = self.base / "npm.log"
        self.npm_log.write_text("")
        fake_bin = self.base / "fake-bin"
        fake_bin.mkdir()
        fake = fake_bin / "npm"
        fake.write_text(FAKE_NPM)
        fake.chmod(fake.stat().st_mode | stat.S_IEXEC)

        self.environment = {
            "HOME": str(self.home),
            "RC_ARTIFACT_DIR": str(self.base / "artifacts"),
            "GITHUB_PAT": PAT,
            "NPM_TOKEN": TOKEN,
            "FAKE_NPM_LOG": str(self.npm_log),
            "GIT_CONFIG_NOSYSTEM": "1",
        }
        patcher = mock.patch.dict(os.environ, self.environment)
        patcher.start()
        self.addCleanup(patcher.stop)
        os.environ.pop("ZEST_RELEASE", None)
        os.environ.pop("FAKE_NPM_MISSING_BETA", None)
        os.environ.pop("FAKE_NPM_FAIL_BETA", None)

        self.log_lines = []
        self.plugin = load_plugin(self.log_lines)
        self.plugin._tools_command = lambda *verb: [sys.executable, "-m", "zest_tools", *verb]
        self.plugin._node_environment = lambda code_dir: {"PATH": os.pathsep.join([str(fake_bin), os.environ["PATH"]])}
        # The real npm comes from .deps, through zest_tools, in the child processes
        self.addCleanup(os.environ.pop, "ZEST_RELEASE", None)

    def change(self, subject, path):
        target = self.root / path
        target.write_text(target.read_text() + "// change\n")
        git(self.root, "add", "--all")
        git(self.root, "commit", "--message", subject)
        git(self.root, "push", "origin", "main")

    def npm_calls(self):
        return self.npm_log.read_text().splitlines()

    def test_refuses_with_no_secrets_and_touches_nothing(self):
        del os.environ["NPM_TOKEN"]
        before = git_output(self.remote, "rev-parse", "main")
        with self.assertRaisesRegex(RuntimeError, "NPM_TOKEN"):
            self.plugin.release(self.root)
        self.assertEqual(git_output(self.remote, "rev-parse", "main"), before)
        self.assertEqual(self.npm_calls(), [])

    def test_a_run_with_nothing_to_release_stages_nothing(self):
        self.plugin.release(self.root)
        self.assertEqual(self.npm_calls(), [])
        self.assertEqual(git_output(self.root, "status", "--porcelain"), "")

    def test_a_release_proves_npm_first_tags_and_stages_in_dependency_order(self):
        self.change("fix: repair alpha", "packages/alpha/src/index.js")
        self.change("fix: repair beta", "packages/beta/src/index.js")
        self.plugin.release(self.root)

        calls = self.npm_calls()
        self.assertEqual(calls[0], "stage list")
        dry_runs = [call for call in calls if "--dry-run" in call]
        staged = [call for call in calls if call.startswith("stage publish") and "--dry-run" not in call]
        self.assertEqual(len(dry_runs), 2)
        self.assertEqual(len(staged), 2)
        self.assertLess(calls.index(dry_runs[-1]), calls.index(staged[0]))
        self.assertIn("alpha", staged[0])
        self.assertIn("beta", staged[1])
        self.assertTrue(all("--access public" in call for call in staged))

        tags = git_output(self.remote, "tag").split()
        self.assertIn("alpha/v0.1.1", tags)
        self.assertIn("beta/v0.2.1", tags)
        self.assertIn('"version": "0.1.1"', git_output(self.remote, "show", "main:packages/alpha/package.json"))
        self.assertIn(">=0.1.1 <1.0.0", git_output(self.remote, "show", "main:packages/beta/package.json"))
        self.assertIn("ci: release", git_output(self.remote, "log", "-1", "--format=%s", "main"))

    def test_keeps_the_secrets_out_of_the_log_and_the_arguments(self):
        self.change("fix: repair alpha", "packages/alpha/src/index.js")
        self.plugin.release(self.root)
        everything = "\n".join(self.log_lines) + self.npm_log.read_text()
        self.assertNotIn(TOKEN, everything)
        self.assertNotIn(PAT, everything)
        npmrc = self.home / ".npmrc"
        self.assertIn(TOKEN, npmrc.read_text())
        self.assertEqual(stat.S_IMODE(npmrc.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE((self.home / ".git-credentials").stat().st_mode), 0o600)
        self.assertNotIn(PAT, git_output(self.root, "remote", "-v"))

    def test_a_package_that_npm_does_not_have_refuses_with_nothing_tagged(self):
        self.change("fix: repair beta", "packages/beta/src/index.js")
        os.environ["FAKE_NPM_MISSING_BETA"] = "1"
        before = git_output(self.remote, "rev-parse", "main")
        with self.assertRaisesRegex(RuntimeError, "first-publish"):
            self.plugin.release(self.root)
        self.assertEqual(git_output(self.remote, "rev-parse", "main"), before)
        self.assertNotIn("beta/v0.2.1", git_output(self.remote, "tag").split())
        self.assertFalse([call for call in self.npm_calls() if call.startswith("stage publish")])

    def test_a_stage_failure_after_the_tag_says_how_to_recover(self):
        self.change("fix: repair alpha", "packages/alpha/src/index.js")
        self.change("fix: repair beta", "packages/beta/src/index.js")
        os.environ["FAKE_NPM_FAIL_BETA"] = "1"
        with self.assertRaisesRegex(RuntimeError, r"beta/v0\.2\.1"):
            self.plugin.release(self.root)
        # Alpha still staged, because one failure must not leave the others behind
        staged = [call for call in self.npm_calls() if call.startswith("stage publish") and "--dry-run" not in call]
        self.assertTrue(any("alpha" in call for call in staged))

    def test_each_job_name_has_a_job_file(self):
        for name in self.plugin.JOBS:
            text = (REPOSITORY_ROOT / ".reactorcide" / "jobs" / f"{name}.yaml").read_text()
            self.assertIn(f"ZEST_JOB: {name}\n", text)


class WorkflowContractTests(unittest.TestCase):
    workflows = REPOSITORY_ROOT / ".reactorcide" / "workflows"

    def test_only_the_release_job_names_a_secret(self):
        for path in (REPOSITORY_ROOT / ".reactorcide" / "jobs").glob("*.yaml"):
            if path.stem != "release":
                self.assertNotIn("${secret:", path.read_text(), path.name)

    def test_a_pull_request_workflow_has_no_release_node(self):
        self.assertNotIn("release", (self.workflows / "pr.yaml").read_text().split("jobs:")[1])
        self.assertNotIn("release", (self.workflows / "main.yaml").read_text().split("jobs:")[1])

    def test_the_grant_matches_the_node_name_in_the_release_workflow(self):
        grants = (REPOSITORY_ROOT / ".reactorcide" / "secret-grants.yaml").read_text()
        self.assertIn("value: zest-release\n", grants)
        self.assertIn("  zest-release:\n", (self.workflows / "release.yaml").read_text())


if __name__ == "__main__":
    unittest.main()
