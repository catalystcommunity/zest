"""The release code cannot run under `run-local`, so its first real run would be the
first merge. These run the real semver-tags and the real git flow against a local
bare repository, and stop only at the npm publish, which the job holds."""

import io
import json
import os
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from zest_tools import commands, deps, release
from zest_tools.commands import REPOSITORY_ROOT, ToolFailed


def git(root, *arguments):
    subprocess.run(["git", *arguments], cwd=root, check=True, capture_output=True, text=True)


def git_output(root, *arguments):
    return subprocess.run(["git", *arguments], cwd=root, check=True, capture_output=True, text=True).stdout.strip()


def write_package(root, directory, name, version, dependencies=None):
    path = root / directory
    (path / "src").mkdir(parents=True, exist_ok=True)
    (path / "src" / "index.js").write_text("export default 1;\n")
    manifest = {"name": name, "version": version, "main": "src/index.js", "files": ["src"], "type": "module"}
    if dependencies:
        manifest["dependencies"] = dependencies
    (path / "package.json").write_text(json.dumps(manifest, indent=2) + "\n")


class ReleaseRepository(unittest.TestCase):
    """A repository in the shape of this one, with a bare remote and the old tags."""

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        base = Path(self.temporary.name)
        self.remote = base / "remote.git"
        self.root = base / "work"
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
            "workspaces": ["packages/*"],
            "dependencies": {"@scope/alpha": ">=0.1.0 <1.0.0", "@scope/beta": ">=0.1.0 <1.0.0"},
        }, indent=2) + "\n")
        (self.root / ".gitignore").write_text("node_modules\ndist-release\n.deps\n")
        self.commit("chore: start")
        # The tag and the manifest disagree on purpose, as they do in this repository
        git(self.root, "tag", "alpha/v0.1.0")
        git(self.root, "tag", "beta/v0.2.0")
        git(self.root, "tag", "zest/v0.3.9")
        git(self.root, "push", "origin", "main", "--tags")
        environment = mock.patch.dict(os.environ, {
            release.RELEASE_ENVIRONMENT: "1",
            "RC_ARTIFACT_DIR": str(base / "artifacts"),
        })
        environment.start()
        self.addCleanup(environment.stop)
        self.artifacts = base / "artifacts"

    def commit(self, subject, path=None):
        if path:
            target = self.root / path
            target.write_text(target.read_text() + "// change\n")
        git(self.root, "add", "--all")
        git(self.root, "commit", "--message", subject)

    def plan(self):
        return {item["target"]: item for item in release.compute_plan(self.root)}

    def manifest(self, directory):
        return json.loads((self.root / directory / "package.json").read_text())


class PlanTests(ReleaseRepository):
    def test_nothing_changed_means_no_release(self):
        self.assertEqual(self.plan(), {})

    def test_a_fix_in_one_package_releases_only_that_package(self):
        self.commit("fix: repair alpha", "packages/alpha/src/index.js")
        plan = self.plan()
        self.assertEqual(set(plan), {"alpha"})
        self.assertEqual(plan["alpha"]["version"], "0.1.1")
        self.assertEqual(plan["alpha"]["tag"], "alpha/v0.1.1")
        self.assertEqual(plan["alpha"]["name"], "@scope/alpha")

    def test_a_feature_is_a_minor_release(self):
        self.commit("feat: add to beta", "packages/beta/src/index.js")
        self.assertEqual(self.plan()["beta"]["version"], "0.3.0")

    def test_the_umbrella_continues_from_its_tag_and_not_from_its_manifest(self):
        self.commit("fix: repair the umbrella", "src/index.js")
        self.assertEqual(self.plan()["zest"]["version"], "0.3.10")

    def test_a_change_with_no_release_type_releases_nothing(self):
        for kind in ("chore", "docs", "test", "ci", "build", "refactor", "style", "norelease"):
            self.commit(f"{kind}: change alpha", "packages/alpha/src/index.js")
        self.assertEqual(self.plan(), {})

    def test_a_release_type_after_those_still_releases(self):
        self.commit("chore: change alpha", "packages/alpha/src/index.js")
        self.commit("fix: repair alpha", "packages/alpha/src/index.js")
        self.assertEqual(self.plan()["alpha"]["version"], "0.1.1")

    def test_a_change_outside_the_packages_releases_nothing(self):
        (self.root / "demo.js").write_text("// demo\n")
        self.commit("fix: repair the demo")
        self.assertEqual(self.plan(), {})


class ApplyVersionTests(ReleaseRepository):
    def test_writes_versions_and_raises_the_low_bound_of_a_sibling_released_with_it(self):
        packages = release.find_packages(self.root)
        release.apply_versions([
            {"name": "@scope/alpha", "version": "0.1.1"},
            {"name": "@scope/beta", "version": "0.2.1"},
        ], packages)
        self.assertEqual(self.manifest("packages/alpha")["version"], "0.1.1")
        beta = self.manifest("packages/beta")
        self.assertEqual(beta["version"], "0.2.1")
        self.assertEqual(beta["dependencies"]["@scope/alpha"], ">=0.1.1 <1.0.0")

    def test_does_not_touch_a_package_that_is_not_released(self):
        before = (self.root / "packages/beta/package.json").read_text()
        release.apply_versions([{"name": "@scope/alpha", "version": "0.1.1"}], release.find_packages(self.root))
        self.assertEqual((self.root / "packages/beta/package.json").read_text(), before)

    def test_refuses_a_version_that_leaves_a_sibling_range_and_writes_nothing(self):
        before = (self.root / "packages/alpha/package.json").read_text()
        with self.assertRaisesRegex(ToolFailed, "outside the range"):
            release.apply_versions([{"name": "@scope/alpha", "version": "1.0.0"}], release.find_packages(self.root))
        self.assertEqual((self.root / "packages/alpha/package.json").read_text(), before)


class OrderTests(ReleaseRepository):
    def test_a_sibling_comes_before_the_package_that_needs_it(self):
        packages = release.find_packages(self.root)
        order = release.dependency_order(["@scope/umbrella", "@scope/beta", "@scope/alpha"], packages)
        self.assertEqual(order, ["@scope/alpha", "@scope/beta", "@scope/umbrella"])

    def test_leaves_out_a_package_that_is_not_released(self):
        packages = release.find_packages(self.root)
        self.assertEqual(release.dependency_order(["@scope/beta"], packages), ["@scope/beta"])


class FullFlowTests(ReleaseRepository):
    def fake_lock(self):
        """npm rewrites the lock file in a real release, and this small repository has none."""
        real_npm = deps.npm

        def npm(*arguments, **options):
            if arguments[:1] == ("install",):
                (self.root / "package-lock.json").write_text("{}\n")
                return commands.Result(0, "")
            return real_npm(*arguments, **options)

        return mock.patch.object(deps, "npm", npm)

    def release_steps(self):
        with self.fake_lock():
            release.stamp(self.root)
            release.pack(self.root)
            release.tag(self.root)

    def test_stamps_packs_commits_tags_and_pushes(self):
        self.commit("fix: repair alpha", "packages/alpha/src/index.js")
        self.commit("feat: add to beta", "packages/beta/src/index.js")
        self.release_steps()

        marker = json.loads((self.artifacts / "release.json").read_text())
        self.assertEqual({item["tag"] for item in marker["packages"]}, {"alpha/v0.1.1", "beta/v0.3.0"})

        tarballs = json.loads((self.artifacts / "tarballs.json").read_text())
        self.assertEqual([item["name"] for item in tarballs], ["@scope/alpha", "@scope/beta"])
        for item in tarballs:
            self.assertTrue(Path(item["tarball"]).is_file())

        remote_tags = git_output(self.remote, "tag").split()
        self.assertIn("alpha/v0.1.1", remote_tags)
        self.assertIn("beta/v0.3.0", remote_tags)
        self.assertEqual(git_output(self.remote, "rev-parse", "main"), git_output(self.root, "rev-parse", "HEAD"))
        self.assertEqual(git_output(self.remote, "rev-parse", "alpha/v0.1.1^{commit}"), git_output(self.remote, "rev-parse", "main"))
        self.assertIn('"version": "0.1.1"', git_output(self.remote, "show", "alpha/v0.1.1:packages/alpha/package.json"))
        self.assertIn(">=0.1.1 <1.0.0", git_output(self.remote, "show", "beta/v0.3.0:packages/beta/package.json"))
        self.assertEqual(self.manifest("packages/beta")["version"], "0.3.0")

    def test_the_release_commit_does_not_cause_another_release(self):
        self.commit("fix: repair alpha", "packages/alpha/src/index.js")
        self.release_steps()
        self.assertEqual(self.plan(), {})

    def test_the_next_fix_after_a_release_moves_on_from_the_new_tag(self):
        self.commit("fix: repair alpha", "packages/alpha/src/index.js")
        self.release_steps()
        self.commit("fix: repair alpha again", "packages/alpha/src/index.js")
        self.assertEqual(self.plan()["alpha"]["version"], "0.1.2")

    def test_a_run_with_no_release_writes_nothing(self):
        before = git_output(self.remote, "rev-parse", "main")
        release.stamp(self.root)
        release.pack(self.root)
        release.tag(self.root)
        self.assertEqual(git_output(self.remote, "rev-parse", "main"), before)
        self.assertEqual(git_output(self.root, "status", "--porcelain"), "")

    def test_main_moving_before_the_stamp_is_picked_up(self):
        other = Path(self.temporary.name) / "other"
        subprocess.run(["git", "clone", self.remote, other], check=True, capture_output=True)
        git(other, "config", "user.email", "o@example.com")
        git(other, "config", "user.name", "Other")
        target = other / "packages/beta/src/index.js"
        target.write_text(target.read_text() + "// other\n")
        git(other, "add", "--all")
        git(other, "commit", "--message", "feat: from another merge")
        git(other, "push", "origin", "main")

        self.commit("fix: repair alpha", "packages/alpha/src/index.js")
        self.release_steps()
        self.assertIn("beta/v0.3.0", git_output(self.remote, "tag").split())

    def test_main_moving_after_the_stamp_refuses_and_leaves_no_tag(self):
        self.commit("fix: repair alpha", "packages/alpha/src/index.js")
        with self.fake_lock():
            release.stamp(self.root)
            release.pack(self.root)

        other = Path(self.temporary.name) / "other"
        subprocess.run(["git", "clone", self.remote, other], check=True, capture_output=True)
        git(other, "config", "user.email", "o@example.com")
        git(other, "config", "user.name", "Other")
        (other / "new.txt").write_text("new\n")
        git(other, "add", "--all")
        git(other, "commit", "--message", "chore: moved main")
        git(other, "push", "origin", "main")

        with self.assertRaisesRegex(ToolFailed, "push failed"):
            release.tag(self.root)
        self.assertNotIn("alpha/v0.1.1", git_output(self.remote, "tag").split())
        self.assertNotIn("alpha/v0.1.1", git_output(self.root, "tag").split())

    def test_a_tag_on_a_tree_that_moved_after_the_stamp_is_refused(self):
        self.commit("fix: repair alpha", "packages/alpha/src/index.js")
        with self.fake_lock():
            release.stamp(self.root)
        git(self.root, "checkout", "--", ".")
        (self.root / "x.txt").write_text("x\n")
        self.commit("chore: an unplanned commit")
        with self.assertRaisesRegex(ToolFailed, "has moved"):
            release.tag(self.root)


class GuardTests(unittest.TestCase):
    def test_the_writing_steps_refuse_without_the_release_environment(self):
        with mock.patch.dict(os.environ):
            os.environ.pop(release.RELEASE_ENVIRONMENT, None)
            for step in (release.stamp, release.pack, release.tag):
                with self.assertRaisesRegex(ToolFailed, "Only the release job"):
                    step()


class TarballTests(unittest.TestCase):
    def tarball(self, directory, manifest, files):
        path = Path(directory) / "package.tgz"
        with tarfile.open(path, "w:gz") as archive:
            contents = {"package.json": json.dumps(manifest), **files}
            for name, text in contents.items():
                data = text.encode()
                info = tarfile.TarInfo(f"package/{name}")
                info.size = len(data)
                archive.addfile(info, io.BytesIO(data))
        return path

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.good = {"name": "@s/a", "version": "1.2.3", "main": "src/index.js"}

    def test_accepts_a_good_tarball(self):
        release.check_tarball(self.tarball(self.temporary.name, self.good, {"src/index.js": ""}), "@s/a", "1.2.3")

    def test_refuses_a_missing_main_file(self):
        with self.assertRaisesRegex(ToolFailed, "main file"):
            release.check_tarball(self.tarball(self.temporary.name, self.good, {}), "@s/a", "1.2.3")

    def test_refuses_the_wrong_version(self):
        with self.assertRaisesRegex(ToolFailed, "version"):
            release.check_tarball(self.tarball(self.temporary.name, self.good, {"src/index.js": ""}), "@s/a", "9.9.9")

    def test_refuses_test_files_and_a_local_dependency(self):
        manifest = {**self.good, "dependencies": {"@s/b": "file:../b"}}
        path = self.tarball(self.temporary.name, manifest, {"src/index.js": "", "__tests__/a.spec.js": ""})
        with self.assertRaisesRegex(ToolFailed, "__tests__.*file:|file:.*__tests__"):
            release.check_tarball(path, "@s/a", "1.2.3")


class RepositoryContractTests(unittest.TestCase):
    """This repository, as it is, must be in the shape that the release code reads."""

    def test_each_sibling_range_is_one_that_the_stamp_can_read(self):
        packages = release.find_packages()
        names = {package.name for package in packages}
        for package in packages:
            for dependency, version_range in package.manifest.get("dependencies", {}).items():
                if dependency in names:
                    release._range_bounds(version_range)

    def test_each_package_has_a_target_with_an_existing_tag_name(self):
        arguments = release.semver_tags_arguments()
        targets = [arguments[i + 1] for i, part in enumerate(arguments) if part == "--target"]
        self.assertEqual(len(targets), len(release.find_packages()))
        self.assertIn("base-components=packages/base-components", targets)
        self.assertTrue(targets[-1].startswith("zest=src,"))

    def test_the_real_packages_pack_and_pass_the_check(self):
        with tempfile.TemporaryDirectory() as into:
            for package in release.find_packages():
                release._pack_one(package, package.manifest["version"], Path(into), REPOSITORY_ROOT)

    def test_no_github_actions_workflow_is_left(self):
        self.assertFalse((REPOSITORY_ROOT / ".github" / "workflows").exists())


if __name__ == "__main__":
    unittest.main()
