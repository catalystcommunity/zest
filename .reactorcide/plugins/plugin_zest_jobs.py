"""Runnerlib lifecycle jobs for the Zest workflows.

A job calls the same Python modules that `tools.sh` calls, so that a local run and
a CI run cannot drift. `ZEST_JOB` selects the job, so that the command in each job
file is the same, and the work lives in this trusted CI source.

Only the release job holds a secret, and only this file reads it.
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import tarfile
from pathlib import Path
from typing import Callable, Dict, List

from src.logging import log_stdout
from src.plugins import Plugin, PluginContext, PluginPhase


def _run(
    command: List[str],
    *,
    cwd: Path,
    env: Dict[str, str] | None = None,
    check: bool = True,
) -> bool:
    """Run one command and log each line of its output.

    Output that a child writes to the container's stdout can arrive out of order
    or not at all, and a failure then shows only `exit status 1`.

    A secret goes in `env` or in a file, never in the arguments, which the process
    table can show.
    """
    log_stdout(f"Running: {shlex.join(command)}")
    finished = subprocess.Popen(
        command,
        cwd=cwd,
        env={**os.environ, **(env or {})},
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    for line in finished.stdout:
        log_stdout(line.rstrip("\n"))
    code = finished.wait()
    if check and code != 0:
        raise RuntimeError(f"`{shlex.join(command)}` exited {code}.")
    return code == 0


def _tools_command(*verb: str) -> List[str]:
    return ["uv", "run", "--quiet", "--no-project", "--python", ">=3.11", "python", "-m", "zest_tools", *verb]


def _tools(code_dir: Path, *verb: str) -> None:
    """One `tools.sh` verb, through the same module that a person types."""
    _run(_tools_command(*verb), cwd=code_dir, env={"PYTHONPATH": str(code_dir / "tools")})


def conventional_commits(code_dir: Path) -> None:
    _tools(code_dir, "commits", "check")


def test(code_dir: Path) -> None:
    _tools(code_dir, "test-tools")
    _tools(code_dir, "test")
    _tools(code_dir, "test-build")


def test_e2e(code_dir: Path) -> None:
    _tools(code_dir, "test-e2e")


def audit(code_dir: Path) -> None:
    _tools(code_dir, "audit")


def _git_credentials(code_dir: Path, token: str) -> None:
    """Let git push as the CI identity. A token in a remote URL shows in `git remote -v`."""
    credentials = Path.home() / ".git-credentials"
    credentials.write_text(f"https://x-access-token:{token}@github.com\n")
    credentials.chmod(0o600)
    _run(["git", "config", "--global", "credential.helper", "store"], cwd=code_dir)
    _run(["git", "config", "--global", "user.name", "catalystcommunityci"], cwd=code_dir)
    _run(["git", "config", "--global", "user.email", "ci@catalystcommunity.org"], cwd=code_dir)


def _node_environment(code_dir: Path) -> Dict[str, str]:
    """The fetched npm is a script that starts with `#!/usr/bin/env node`, and the image has no node."""
    found = sorted((code_dir / ".deps").glob("node-*/bin"))
    if not found:
        raise RuntimeError("`./tools.sh deps` did not fetch Node.")
    return {"PATH": os.pathsep.join([str(found[-1]), os.environ.get("PATH", "")])}


def _tarball_package_name(tarball: Path) -> str:
    """`npm pack` flattens the scope into the file name, so read the name inside."""
    with tarfile.open(tarball, "r:gz") as archive:
        return json.loads(archive.extractfile("package/package.json").read())["name"]


def _refuse_unpublished_packages(tarballs: List[Path], code_dir: Path, env: Dict[str, str]) -> None:
    """Staging cannot create a package. It answers 404, so refuse before anything is public."""
    missing = [
        tarball for tarball in tarballs
        if not _run(["npm", "view", _tarball_package_name(tarball), "version", "--prefer-online"], cwd=code_dir, env=env, check=False)
    ]
    if missing:
        names = ", ".join(_tarball_package_name(tarball) for tarball in missing)
        raise RuntimeError(
            f"npm does not have: {names}. `npm stage publish` cannot create a package. "
            "A maintainer runs `./tools.sh release first-publish` one time and publishes each one "
            "with 2FA. Run this release again after that. Nothing is tagged and nothing is published."
        )


def release(code_dir: Path) -> None:
    """Stamp, pack, prove that npm will accept the result, tag, and stage.

    The order is the design. A tag cannot be taken back, so nothing is tagged until
    each tarball exists and npm has answered. A staged package can be rejected, so
    it comes last. The token cannot publish outright: a maintainer approves each
    staged version with 2FA.
    """
    wanted = {
        "GITHUB_PAT": "the git grant, `catalystcommunity/ci:githubpat`",
        "NPM_TOKEN": "the npm staging grant, `catalystcommunity/ci:npmpublish`",
    }
    values = {name: os.environ.get(name, "").strip() for name in wanted}
    missing = [f"  {name}: {purpose}" for name, purpose in wanted.items() if not values[name]]
    if missing:
        raise RuntimeError("The release refuses rather than half-publishing. Missing:\n" + "\n".join(missing))

    os.environ["ZEST_RELEASE"] = "1"
    artifacts = Path(os.environ.get("RC_ARTIFACT_DIR", code_dir / "dist-release"))

    _git_credentials(code_dir, values["GITHUB_PAT"])
    _tools(code_dir, "deps")
    _tools(code_dir, "release", "stamp")
    marker = json.loads((artifacts / "release.json").read_text())
    if not marker["packages"]:
        log_stdout("No release: no commit since the last tags asks for a version change.")
        return
    _tools(code_dir, "release", "pack")
    tarballs = [Path(item["tarball"]) for item in json.loads((artifacts / "tarballs.json").read_text())]

    # A publisher that cannot publish must be found before the first step that
    # cannot be undone. `npm stage list` proves the subcommand and the token together.
    npmrc = Path.home() / ".npmrc"
    npmrc.write_text(f"//registry.npmjs.org/:_authToken={values['NPM_TOKEN']}\n")
    npmrc.chmod(0o600)
    env = _node_environment(code_dir)
    _run(["npm", "stage", "list"], cwd=code_dir, env=env)
    _refuse_unpublished_packages(tarballs, code_dir, env)
    for tarball in tarballs:
        _run(["npm", "stage", "publish", str(tarball), "--access", "public", "--dry-run"], cwd=code_dir, env=env)
    log_stdout("npm answered. Nothing is public yet.")

    _tools(code_dir, "release", "tag")

    failed = []
    for tarball in tarballs:
        if not _run(["npm", "stage", "publish", str(tarball), "--access", "public"], cwd=code_dir, env=env, check=False):
            failed.append(_tarball_package_name(tarball))
    if failed:
        tags = ", ".join(item["tag"] for item in marker["packages"] if item["name"] in failed)
        raise RuntimeError(
            f"The tags are pushed, and these did not stage: {', '.join(failed)}. A new release will not retry them, "
            f"because no commit follows the tags. Check out each tag ({tags}), then run `npm pack` in the package "
            "directory and `npm stage publish <tarball> --access public`."
        )
    log_stdout(
        f"Staged {len(tarballs)} package(s) on npmjs. A maintainer approves each one with 2FA: "
        "`npm stage list`, then `npm stage approve <stage-id>`."
    )


JOBS: Dict[str, Callable[[Path], None]] = {
    "conventional-commits": conventional_commits,
    "test": test,
    "test-e2e": test_e2e,
    "audit": audit,
    "release": release,
}


class ZestJobsPlugin(Plugin):
    """Run one selected Zest job after source preparation."""

    def __init__(self):
        super().__init__(name="zest_jobs", priority=50)

    def supported_phases(self):
        return [PluginPhase.POST_SOURCE_PREP]

    def execute(self, context: PluginContext) -> None:
        if context.phase != PluginPhase.POST_SOURCE_PREP:
            return
        name = os.environ.get("ZEST_JOB", "").strip()
        if not name:
            return
        job = JOBS.get(name)
        if job is None:
            raise RuntimeError(f"Unknown ZEST_JOB '{name}'. Valid jobs: {', '.join(sorted(JOBS))}")
        code_dir = Path(context.config.code_dir)
        if not code_dir.is_dir():
            raise RuntimeError(f"Code directory does not exist: {code_dir}")
        log_stdout(f"Starting Zest job: {name}")
        job(code_dir)
        log_stdout(f"Completed Zest job: {name}")
