"""Compute, stamp, pack, and tag a release. Each package has its own version.

semver-tags reads the conventional commits since each package's last tag. The
tags are `<package directory>/v<version>`, and the umbrella package is `zest`.

**Nothing in this file publishes.** The release job in
`.reactorcide/plugins/plugin_zest_jobs.py` holds the npm token, and it stages what
`pack` built. A person can run `plan` and `first-publish` on a workstation. The
steps that write refuse without `ZEST_RELEASE=1`.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import tarfile
from dataclasses import dataclass
from pathlib import Path

from . import commits, deps
from .commands import REPOSITORY_ROOT, ToolFailed, run, say

RELEASE_ENVIRONMENT = "ZEST_RELEASE"
MARKER = "release.json"
UMBRELLA_TARGET = "zest"
#: What the umbrella package publishes. A commit that changes only a package
#: releases only that package, and a consumer of the umbrella package gets it
#: through the version range.
UMBRELLA_PATHS = "src,package.json,README.md,LICENSE"
LICENSE = "LICENSE"


@dataclass(frozen=True)
class Package:
    target: str
    directory: Path

    @property
    def manifest_path(self) -> Path:
        return self.directory / "package.json"

    @property
    def manifest(self) -> dict:
        return json.loads(self.manifest_path.read_text())

    @property
    def name(self) -> str:
        return self.manifest["name"]


def artifact_directory(root: Path = REPOSITORY_ROOT) -> Path:
    return Path(os.environ.get("RC_ARTIFACT_DIR", root / "dist-release"))


def find_packages(root: Path = REPOSITORY_ROOT) -> list[Package]:
    """Each package in `packages/`, and then the umbrella package."""
    found = [Package(path.parent.name, path.parent) for path in sorted((root / "packages").glob("*/package.json"))]
    return [*found, Package(UMBRELLA_TARGET, root)]


def semver_tags_arguments(root: Path = REPOSITORY_ROOT) -> list[str]:
    """The same targets each time. The results come back in this order."""
    arguments = ["run", "--dry_run", "--output_json", "--skip-short-versions"]
    for kind in commits.PATCH_TYPES:
        arguments += ["--patch_types", kind]
    for kind in commits.MINOR_TYPES:
        arguments += ["--minor_types", kind]
    for package in find_packages(root):
        if package.target == UMBRELLA_TARGET:
            arguments += ["--target", f"{UMBRELLA_TARGET}={UMBRELLA_PATHS}"]
        else:
            arguments += ["--target", f"{package.target}={package.directory.relative_to(root)}"]
    return arguments


def parse_plan(output: str, packages: list[Package]) -> list[dict]:
    """semver-tags logs first and prints one JSON object last, with one value per target."""
    for line in reversed(output.strip().splitlines()):
        if line.startswith("{"):
            computed = json.loads(line)
            break
    else:
        raise ToolFailed("semver-tags printed no result. Its output was:\n" + output)

    def column(name: str) -> list[str]:
        return computed[name].split(",")

    by_target = dict(zip(column("Release_package"), zip(
        column("New_release_published"), column("New_release_version"),
        column("New_release_git_tag"), column("Last_release_version"),
    )))
    plan = []
    for package in packages:
        if package.target not in by_target:
            raise ToolFailed(f"semver-tags said nothing about {package.target}. It said: {sorted(by_target)}")
        published, version, tag, last = by_target[package.target]
        if published == "true":
            plan.append({"target": package.target, "name": package.name, "version": version, "tag": tag, "last": last})
    return plan


def compute_plan(root: Path = REPOSITORY_ROOT) -> list[dict]:
    # It logs a page for each target to stderr. A failure shows that log, through parse_plan.
    result = run(
        [deps.semver_tags_program(), *semver_tags_arguments(root)],
        cwd=root, capture=True, quiet=True, merge_stderr=True,
    )
    return parse_plan(result.stdout, find_packages(root))


def plan_report(root: Path = REPOSITORY_ROOT) -> None:
    plan = compute_plan(root)
    if not plan:
        say("No release. No commit since the last tags asks for a version change.")
        return
    say(f"The next release has {len(plan)} package(s):")
    for item in plan:
        print(f"  {item['name']}: {item['last']} -> {item['version']} ({item['tag']})", flush=True)


def _version_tuple(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split("-")[0].split("."))


def _range_bounds(version_range: str) -> tuple[str, str]:
    match = re.fullmatch(r">=(\d+\.\d+\.\d+) <(\d+\.\d+\.\d+)", version_range)
    if not match:
        raise ToolFailed(f"The range `{version_range}` is not `>=low <high`, which each sibling range must be.")
    return match.group(1), match.group(2)


def apply_versions(plan: list[dict], packages: list[Package]) -> None:
    """Write each new version, and raise the low bound of each sibling range that is released with it.

    A released package can need the fix that its sibling releases in the same run,
    and a low bound left behind lets npm keep an old sibling with no warning.

    This refuses a version that leaves a sibling range, because npm would then
    install the old version from the registry for that package. Nothing is written.
    """
    versions = {item["name"]: item["version"] for item in plan}
    released = {item["name"] for item in plan}
    current = {package.name: versions.get(package.name, package.manifest["version"]) for package in packages}
    for package in packages:
        for dependency, version_range in package.manifest.get("dependencies", {}).items():
            if dependency not in current:
                continue
            _low, high = _range_bounds(version_range)
            if _version_tuple(current[dependency]) >= _version_tuple(high):
                raise ToolFailed(
                    f"{dependency} would become {current[dependency]}, which is outside the range "
                    f"`{version_range}` in {package.name}. Change the range in a commit first. Nothing is stamped."
                )
    for package in packages:
        manifest = package.manifest
        if package.name not in released:
            continue
        manifest["version"] = versions[package.name]
        for dependency, version_range in manifest.get("dependencies", {}).items():
            if dependency in versions:
                _low, high = _range_bounds(version_range)
                manifest["dependencies"][dependency] = f">={versions[dependency]} <{high}"
        package.manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


def _require_release() -> None:
    if os.environ.get(RELEASE_ENVIRONMENT) != "1":
        raise ToolFailed(f"Only the release job writes a release. It sets {RELEASE_ENVIRONMENT}=1.")


def _head(root: Path) -> str:
    return run(["git", "rev-parse", "HEAD"], cwd=root, capture=True, quiet=True).stdout.strip()


def stamp(root: Path = REPOSITORY_ROOT) -> None:
    """Move to the head of main, compute the versions from it, and write them. No commit and no push.

    The move comes first. A `feat:` that merges while this job runs would otherwise
    ship in a patch release, and its minor bump would never apply.
    """
    _require_release()
    artifacts = artifact_directory(root)
    artifacts.mkdir(parents=True, exist_ok=True)
    if (root / ".git" / "shallow").exists():
        run(["git", "fetch", "--unshallow", "origin"], cwd=root)
    run(["git", "fetch", "--tags", "--force", "origin"], cwd=root)
    pull = run(["git", "pull", "--rebase", "origin", "main"], cwd=root, check=False)
    if not pull.ok:
        run(["git", "rebase", "--abort"], cwd=root, check=False)
        raise ToolFailed("This tree could not move to the head of main. Nothing is stamped.")

    plan = compute_plan(root)
    (artifacts / MARKER).write_text(json.dumps({"base": _head(root), "packages": plan}, indent=2) + "\n")
    if not plan:
        say("No release. No commit since the last tags asks for a version change.")
        return
    apply_versions(plan, find_packages(root))
    # The lock file holds the version of each workspace, and `npm ci` refuses when they disagree
    deps.npm("install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund", cwd=root)
    say(f"Stamped {len(plan)} package(s). Nothing is committed until the tarballs exist.")


def read_marker(root: Path = REPOSITORY_ROOT) -> dict:
    path = artifact_directory(root) / MARKER
    if not path.is_file():
        raise ToolFailed(f"{path} is not there. `release stamp` writes it.")
    return json.loads(path.read_text())


def dependency_order(names: list[str], packages: list[Package]) -> list[str]:
    """A package comes after the siblings that it depends on, so that an approver can go from the top."""
    manifests = {package.name: package.manifest for package in packages}
    ordered: list[str] = []

    def visit(name: str) -> None:
        if name in ordered or name not in manifests:
            return
        for dependency in manifests[name].get("dependencies", {}):
            visit(dependency)
        ordered.append(name)

    for name in sorted(names):
        visit(name)
    return [name for name in ordered if name in names]


def check_tarball(tarball: Path, name: str, version: str) -> None:
    """`npm pack` succeeds on a package that holds nothing useful, so read what it wrote."""
    with tarfile.open(tarball) as archive:
        members = {member.name.removeprefix("package/") for member in archive.getmembers()}
        manifest_file = archive.extractfile("package/package.json")
        manifest = json.loads(manifest_file.read())
    problems = []
    if manifest["name"] != name:
        problems.append(f"its name is {manifest['name']}")
    if manifest["version"] != version:
        problems.append(f"its version is {manifest['version']}, and this release is {version}")
    if manifest.get("main") not in members:
        problems.append(f"its main file {manifest.get('main')} is not in it")
    if LICENSE not in members:
        problems.append(f"its {LICENSE} file is not in it")
    for member in members:
        if member.startswith(("__tests__/", "demo/", "e2e/", "tools/", "node_modules/", ".reactorcide/")):
            problems.append(f"it holds {member}")
    for dependency, version_range in manifest.get("dependencies", {}).items():
        if version_range.startswith(("file:", "workspace:", "link:")):
            problems.append(f"its dependency {dependency} is {version_range}")
    if problems:
        raise ToolFailed(f"{tarball.name} is not fit to publish: {'; '.join(problems)}.")


def _pack_one(package: Package, version: str, into: Path, root: Path) -> Path:
    into.mkdir(parents=True, exist_ok=True)
    # The root holds the one license. npm leaves a symbolic link out of a tarball, so a package holds a copy to pack.
    copied = None if package.directory == root else package.directory / LICENSE
    if copied:
        shutil.copyfile(root / LICENSE, copied)
    try:
        result = deps.npm("pack", "--pack-destination", str(into), "--silent", cwd=package.directory, capture=True)
    finally:
        if copied:
            copied.unlink()
    tarball = into / result.stdout.strip().splitlines()[-1]
    check_tarball(tarball, package.name, version)
    return tarball


def pack(root: Path = REPOSITORY_ROOT) -> None:
    """Build the tarball of each released package, and write down the order to stage them."""
    _require_release()
    marker = read_marker(root)
    if not marker["packages"]:
        say("No release to pack.")
        return
    packages = {package.name: package for package in find_packages(root)}
    into = artifact_directory(root) / "npm"
    versions = {item["name"]: item["version"] for item in marker["packages"]}
    order = dependency_order(list(versions), list(packages.values()))
    tarballs = [
        {"name": name, "tarball": str(_pack_one(packages[name], versions[name], into, root))}
        for name in order
    ]
    (artifact_directory(root) / "tarballs.json").write_text(json.dumps(tarballs, indent=2) + "\n")
    say(f"Packed and checked {len(tarballs)} tarball(s) in {into}.")


def tag(root: Path = REPOSITORY_ROOT) -> None:
    """Commit the stamp, tag it, and push them in one atomic operation.

    If main moved while the job ran, the push fails and so does the release. The
    next run computes the versions from what main holds then.
    """
    _require_release()
    marker = read_marker(root)
    plan = marker["packages"]
    if not plan:
        say("No release to tag.")
        return
    if _head(root) != marker["base"]:
        raise ToolFailed(f"The versions came from {marker['base'][:12]}, and this tree has moved. Nothing is tagged.")
    packages = {package.name: package for package in find_packages(root)}
    for item in plan:
        found = packages[item["name"]].manifest["version"]
        if found != item["version"]:
            raise ToolFailed(f"{item['name']} says {found}, and this release is {item['version']}. Nothing is tagged.")

    run(["git", "add", "package-lock.json", *[packages[item["name"]].manifest_path for item in plan]], cwd=root)
    subjects = ", ".join(item["tag"] for item in plan)
    run(["git", "commit", "--message", f"ci: release {subjects}"], cwd=root)
    names = [item["tag"] for item in plan]
    for name in names:
        run(["git", "tag", name], cwd=root)
    push = run(
        ["git", "push", "--atomic", "origin", "HEAD:main", *(f"refs/tags/{name}" for name in names)],
        cwd=root,
        check=False,
    )
    if not push.ok:
        for name in names:
            run(["git", "tag", "--delete", name], cwd=root, check=False)
        raise ToolFailed("The push failed, probably because main moved. Nothing is tagged. Run the release again.")
    say(f"Tagged {subjects}.")


def first_publish(root: Path = REPOSITORY_ROOT) -> None:
    """Pack each package that npm does not have, and print what a maintainer runs.

    `npm stage publish` cannot create a package, so the first publish of each one
    is a person with 2FA. This publishes nothing.
    """
    into = artifact_directory(root) / "first-publish"
    packages = find_packages(root)
    names = dependency_order([package.name for package in packages], packages)
    by_name = {package.name: package for package in packages}
    missing = []
    for name in names:
        # --prefer-online, because the public URL caches a 404
        found = deps.npm("view", name, "version", "--prefer-online", cwd=root, capture=True, check=False, quiet=True)
        if found.ok and found.stdout.strip():
            say(f"{name} is on npm at {found.stdout.strip()}.")
        else:
            missing.append(_pack_one(by_name[name], by_name[name].manifest["version"], into, root))
    if not missing:
        say("Each package is on npm. Staging can release all of them.")
        return
    say("A maintainer runs these one time, with 2FA. After that, staging releases each package:")
    for tarball in missing:
        print(f"  npm publish {tarball} --access public", flush=True)
