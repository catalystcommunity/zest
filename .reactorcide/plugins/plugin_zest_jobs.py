"""Runnerlib lifecycle jobs for the Zest workflows.

A job calls the same Python modules that `tools.sh` calls, so that a local run and
a CI run cannot drift. `ZEST_JOB` selects the job, so that the command in each job
file is the same, and the work lives in this trusted CI source.

Only the release job and the site deploy job hold secrets, and only this file reads them.
"""

from __future__ import annotations

import base64
import json
import os
import re
import shlex
import shutil
import subprocess
import tarfile
import time
import urllib.request
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
            f"because no commit follows the tags. Check out each tag ({tags}), copy the root LICENSE to the package "
            "directory, then run `npm pack` there and `npm stage publish <tarball> --access public`."
        )
    log_stdout(
        f"Staged {len(tarballs)} package(s) on npmjs. A maintainer approves each one with 2FA: "
        "`npm stage list`, then `npm stage approve <stage-id>`."
    )


BUILDKIT_VERSION = "0.17.3"
KUBECTL_VERSION = "v1.36.5"
HELM_VERSION = "v3.19.0"
HELM_REPOSITORY = "https://raw.githubusercontent.com/catalystcommunity/charts/main"
HELM_CHART = "catalyst-helm/pysocha-site"
HELM_CHART_VERSION = "1.1.1"
PLATFORMS = "linux/amd64,linux/arm64"
SIDECAR_TIMEOUT_SECONDS = 30
VERSION_PATTERN = re.compile(r"\d+\.\d+\.\d+")


def website_release(code_dir: Path) -> Dict[str, str] | None:
    """The next `website/vX.Y.Z` from semver-tags, or None. The commits since the last site tag decide."""
    if (code_dir / ".git" / "shallow").exists():
        _run(["git", "fetch", "--unshallow", "origin"], cwd=code_dir)
    _run(["git", "fetch", "--tags", "--force", "origin"], cwd=code_dir)
    _tools(code_dir, "site", "plan")
    artifacts = Path(os.environ.get("RC_ARTIFACT_DIR", code_dir / "dist-release"))
    found = json.loads((artifacts / "website-release.json").read_text())
    if found is not None and not VERSION_PATTERN.fullmatch(found["version"]):
        raise RuntimeError(f"semver-tags gave the site version {found['version']!r}, which is not X.Y.Z")
    return found


def website_domain(website: Path) -> str:
    """The domain in website/values.yaml. A route for a name that nobody owns is worse than none."""
    match = re.search(r"^domain:\s*(\S+)\s*$", (website / "values.yaml").read_text(), re.M)
    if match is None:
        raise RuntimeError("website/values.yaml has no domain")
    domain = match.group(1).strip("'\"")
    if domain.endswith(".invalid") or "REPLACE-ME" in domain:
        raise RuntimeError(f"website/values.yaml has the placeholder domain {domain}")
    return domain


def pull_secret_manifest(namespace: str, registry: str, user: str, password: str) -> str:
    """The registry pull secret, for `kubectl apply -f -`. `kubectl create secret` would put the
    password in the arguments, which the process table shows."""
    auth = base64.b64encode(f"{user}:{password}".encode()).decode()
    config = json.dumps({"auths": {registry: {"username": user, "password": password, "auth": auth}}})
    return json.dumps({
        "apiVersion": "v1",
        "kind": "Secret",
        "metadata": {"name": "regcred", "namespace": namespace},
        "type": "kubernetes.io/dockerconfigjson",
        "data": {".dockerconfigjson": base64.b64encode(config.encode()).decode()},
    })


def _local_bin() -> Path:
    path = Path.home() / ".local" / "bin"
    path.mkdir(parents=True, exist_ok=True)
    os.environ["PATH"] = os.pathsep.join([str(path), os.environ.get("PATH", "")])
    return path


def _download(url: str) -> bytes:
    log_stdout(f"Downloading {url}")
    with urllib.request.urlopen(url, timeout=600) as response:
        return response.read()


def _ensure_deploy_tools() -> None:
    """The runner image has no buildctl, helm, or kubectl."""
    local_bin = _local_bin()
    if not shutil.which("buildctl"):
        archive = Path("/tmp/buildkit.tar.gz")
        archive.write_bytes(_download(
            f"https://github.com/moby/buildkit/releases/download/v{BUILDKIT_VERSION}"
            f"/buildkit-v{BUILDKIT_VERSION}.linux-amd64.tar.gz"))
        with tarfile.open(archive) as tar:
            member = tar.getmember("bin/buildctl")
            member.name = "buildctl"
            tar.extract(member, local_bin, filter="data")
        archive.unlink()
    if not shutil.which("helm"):
        archive = Path("/tmp/helm.tar.gz")
        archive.write_bytes(_download(f"https://get.helm.sh/helm-{HELM_VERSION}-linux-amd64.tar.gz"))
        with tarfile.open(archive) as tar:
            member = tar.getmember("linux-amd64/helm")
            member.name = "helm"
            tar.extract(member, local_bin, filter="data")
        archive.unlink()
    if not shutil.which("kubectl"):
        (local_bin / "kubectl").write_bytes(_download(f"https://dl.k8s.io/release/{KUBECTL_VERSION}/bin/linux/amd64/kubectl"))
    for name in ("buildctl", "helm", "kubectl"):
        if (local_bin / name).exists():
            (local_bin / name).chmod(0o755)


def _wait_for_builder(code_dir: Path) -> None:
    log_stdout("Waiting for the builder sidecar")
    for _ in range(SIDECAR_TIMEOUT_SECONDS):
        if subprocess.run(["buildctl", "debug", "info"], cwd=code_dir, check=False,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            return
        time.sleep(1)
    raise RuntimeError(f"The builder sidecar is not ready after {SIDECAR_TIMEOUT_SECONDS} seconds.")


def _private_file(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    path.chmod(0o600)
    return path


def website_deploy(code_dir: Path) -> None:
    """Build the demo site from this checkout, push its image, roll the Helm release, apply the route,
    and then push the `website/vX.Y.Z` tag.

    The tag comes last. A failed deploy pushes no tag, so a retry computes the same version.

    The secrets leave the environment first, so no child process gets them. They go only into
    the git credentials, the docker config, the kubeconfig, and the stdin of one `kubectl apply`.
    """
    names = ("GITHUB_PAT", "REGISTRY", "REGISTRY_PATH", "REGISTRY_USER", "REGISTRY_PASSWORD", "KUBECONFIG_CONTENT", "K8S_NAMESPACE", "HELM_RELEASE")
    values = {name: os.environ.pop(name, "").strip() for name in names}
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise RuntimeError("The site deploy needs: " + ", ".join(missing))

    website = code_dir / "website"
    domain = website_domain(website)
    _git_credentials(code_dir, values["GITHUB_PAT"])
    found = website_release(code_dir)
    if found is None:
        log_stdout("No site release: no commit since the last website tag changes what the site shows.")
        return
    version = found["version"]
    image = f"{values['REGISTRY']}/{values['REGISTRY_PATH']}"
    namespace = values["K8S_NAMESPACE"]
    release = values["HELM_RELEASE"]
    log_stdout(f"Deploying {image}:{version} for {domain}")

    _tools(code_dir, "site", "build")
    _ensure_deploy_tools()
    _wait_for_builder(code_dir)

    auth = base64.b64encode(f"{values['REGISTRY_USER']}:{values['REGISTRY_PASSWORD']}".encode()).decode()
    docker_config = _private_file(Path.home() / ".docker" / "config.json", json.dumps({"auths": {values["REGISTRY"]: {"auth": auth}}}))
    kubeconfig = _private_file(Path.home() / ".kube" / "config", values["KUBECONFIG_CONTENT"])
    env = {"DOCKER_CONFIG": str(docker_config.parent), "KUBECONFIG": str(kubeconfig)}

    _run(
        [
            "buildctl", "build",
            "--frontend", "dockerfile.v0",
            "--local", "context=.",
            "--local", "dockerfile=.",
            "--opt", f"platform={PLATFORMS}",
            "--output", f'type=image,"name={image}:{version},{image}:latest",push=true',
        ],
        cwd=website, env=env,
    )

    namespace_manifest = subprocess.run(
        ["kubectl", "create", "namespace", namespace, "--dry-run=client", "-o", "yaml"],
        cwd=website, env={**os.environ, **env}, check=True, text=True, stdout=subprocess.PIPE,
    ).stdout
    secret_manifest = pull_secret_manifest(namespace, values["REGISTRY"], values["REGISTRY_USER"], values["REGISTRY_PASSWORD"])
    for manifest in (namespace_manifest, secret_manifest):
        log_stdout("Running: kubectl apply -f -")
        subprocess.run(["kubectl", "apply", "-f", "-"], cwd=website, env={**os.environ, **env},
                       check=True, text=True, input=manifest, stdout=subprocess.DEVNULL)

    _run(["helm", "repo", "add", "--force-update", "catalyst-helm", HELM_REPOSITORY], cwd=website, env=env)
    _run(["helm", "repo", "update", "catalyst-helm"], cwd=website, env=env)
    _run(
        [
            "helm", "upgrade", "--install", "--wait", "--timeout", "5m",
            "--namespace", namespace, release, HELM_CHART,
            "--version", HELM_CHART_VERSION,
            "-f", "values.yaml",
            "--set", f"image.repository={image}",
            "--set", f"image.tag={version}",
            "--set", "imagePullSecrets[0].name=regcred",
            # The chart Ingress conflicts with the Gateway listeners. httproute.yaml routes.
            "--set", "ingress.enabled=false",
        ],
        cwd=website, env=env,
    )
    _run(["kubectl", "apply", "-f", "httproute.yaml"], cwd=website, env=env)
    log_stdout(f"Deployed {release} {version} to {namespace}. https://{domain}/")

    _run(["git", "tag", found["tag"]], cwd=code_dir)
    if not _run(["git", "push", "origin", f"refs/tags/{found['tag']}"], cwd=code_dir, check=False):
        raise RuntimeError(
            f"The site {version} is live, and the tag {found['tag']} did not push. Another run probably pushed it "
            "first. The next site release computes its version from the tags that are on the remote."
        )


JOBS: Dict[str, Callable[[Path], None]] = {
    "conventional-commits": conventional_commits,
    "test": test,
    "test-e2e": test_e2e,
    "audit": audit,
    "release": release,
    "website-deploy": website_deploy,
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
