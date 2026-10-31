"""The pinned tools, fetched into `.deps` and checked against a pinned digest.

The runner image has no Node, no npm, and no browser libraries, and a job can
run with no root. A job fetches what it needs rather than telling a person to
run something first.
"""

from __future__ import annotations

import hashlib
import os
import platform
import shutil
import tarfile
import tempfile
from pathlib import Path

from .commands import REPOSITORY_ROOT, ToolFailed, run, say

DEPENDENCY_DIR = REPOSITORY_ROOT / ".deps"

#: Check the npm, not the Node: Node 26.1.0 carries npm 11.13.0, which has no
#: `npm stage`, and a release that found that out at the end has already tagged.
#: Read the `npm` field in https://nodejs.org/dist/index.json when you move this
#: pin. `tools/tests/test_deps.py` compares the two versions.
NODE_VERSION = "26.13.0"
NODE_NPM_VERSION = "11.20.0"
#: The first npm that has `npm stage`.
MINIMUM_STAGE_NPM = "11.16.0"

#: From https://nodejs.org/dist/v26.13.0/SHASUMS256.txt
NODE_SHA256 = {
    "linux-x64": "d28a96af6c38596f6d9d97c0ee531c13d238d757742387d1928de822d959e997",
    "linux-arm64": "406fe3fbde1c054adff8b297c16fdb5af6659db327c1ac8acd46b56ef1af9a92",
    "darwin-x64": "8bd636bc981a92e1ab930c02340eece2076eb1aaf94d14e421cdeeddc1292298",
    "darwin-arm64": "6f5b3187d9df9fc007e881167905bc7d69ad26450ddc377c83d63256a2495b6e",
}

SEMVER_TAGS_VERSION = "0.6.1"
SEMVER_TAGS_SHA256 = {
    "linux-amd64": "7ee3b8c9affb716b3bccde1825d37cbdb69628a7c5b88731f24ba94c47a58ab6",
    "linux-arm64": "4c0aba4b53d3ea0b71b05593ff7cc5b0e4dd3fe9b661a2315a1048fcbe4d22fb",
    "darwin-amd64": "c14bf8f0e9e699a98692990ec403e6f153b420fdafc56bcfde8c7b2fa183a041",
    "darwin-arm64": "76d0d575d66c48ba826218cf8e9038efceb92e4bb446e1280c244e34a78802ff",
}

#: What headless Chromium loads, by Debian trixie name. apt brings what these
#: depend on and leaves out what the image already has.
BROWSER_PACKAGES = (
    "libnss3 libnspr4 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdbus-1-3 "
    "libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 "
    "libasound2t64 libatspi2.0-0t64 libglib2.0-0t64 libx11-6 libxcb1 libxext6 "
    "libexpat1 libfontconfig1 fonts-liberation"
).split()

BROWSERS_DIR = DEPENDENCY_DIR / "browsers"
BROWSER_LIBS_DIR = DEPENDENCY_DIR / "browser-libs"


def _platform() -> tuple[str, str]:
    system = {"Linux": "linux", "Darwin": "darwin"}.get(platform.system())
    machine = {"x86_64": "x64", "amd64": "x64", "aarch64": "arm64", "arm64": "arm64"}.get(platform.machine().lower())
    if not system or not machine:
        raise ToolFailed(f"There is no pinned tool for {platform.system()} {platform.machine()}.")
    return system, machine


def _download(url: str, sha256: str, destination: Path) -> Path:
    """The file moves to its destination only when its digest agrees."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_name(destination.name + ".part")
    run(["curl", "--fail", "--location", "--silent", "--show-error", "--retry", "3", "--output", partial, url])
    digest = hashlib.sha256(partial.read_bytes()).hexdigest()
    if digest != sha256:
        partial.unlink()
        raise ToolFailed(f"{url} has the digest {digest}, and the pin is {sha256}. Nothing is installed.")
    partial.replace(destination)
    return destination


def node_dir() -> Path:
    return DEPENDENCY_DIR / f"node-{NODE_VERSION}"


def fetch_node() -> Path:
    directory = node_dir()
    if (directory / "bin" / "node").is_file():
        return directory
    system, machine = _platform()
    release = f"node-v{NODE_VERSION}-{system}-{machine}"
    archive = _download(
        f"https://nodejs.org/dist/v{NODE_VERSION}/{release}.tar.xz",
        NODE_SHA256[f"{system}-{machine}"],
        DEPENDENCY_DIR / f"{release}.tar.xz",
    )
    with tempfile.TemporaryDirectory(dir=DEPENDENCY_DIR) as unpack:
        with tarfile.open(archive) as tar:
            tar.extractall(unpack, filter="tar")
        shutil.move(Path(unpack) / release, directory)
    archive.unlink()
    return directory


def node_environment() -> dict[str, str]:
    """The PATH that puts the pinned Node first. npm finds its own interpreter from it."""
    bin_dir = fetch_node() / "bin"
    return {"PATH": os.pathsep.join([str(bin_dir), os.environ.get("PATH", "")])}


def npm(*arguments: str, cwd: Path = REPOSITORY_ROOT, env: dict[str, str] | None = None, **options):
    return run(["npm", *arguments], cwd=cwd, env={**node_environment(), **(env or {})}, **options)


def npx(*arguments: str, env: dict[str, str] | None = None, **options):
    return run(["npx", *arguments], env={**node_environment(), **(env or {})}, **options)


def semver_tags_program() -> Path:
    path = DEPENDENCY_DIR / "bin" / f"semver-tags-{SEMVER_TAGS_VERSION}"
    if path.is_file():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    system, machine = _platform()
    target = f"{system}-{'amd64' if machine == 'x64' else 'arm64'}"
    archive = _download(
        "https://github.com/catalystcommunity/semver-tags/releases/download/"
        f"v{SEMVER_TAGS_VERSION}/semver-tags-{SEMVER_TAGS_VERSION}-{target}.tar.gz",
        SEMVER_TAGS_SHA256[target],
        DEPENDENCY_DIR / "semver-tags.tar.gz",
    )
    with tarfile.open(archive) as tar:
        # The archive stores `./semver-tags`, not `semver-tags`
        member = next(item for item in tar.getmembers() if item.name.removeprefix("./") == "semver-tags")
        extracted = tar.extractfile(member)
        path.write_bytes(extracted.read())
    path.chmod(0o755)
    archive.unlink()
    return path


def _missing_libraries(browser: Path, env: dict[str, str]) -> list[str]:
    found = run(["ldd", browser], capture=True, check=False, quiet=True, env=env)
    return [line.split()[0] for line in found.stdout.splitlines() if "not found" in line]


def _fetch_browser_libraries() -> None:
    """Download and unpack the libraries with no root, which `playwright install --with-deps` needs.

    A job from a pull request runs with no root and no sudo. apt can download to
    a directory of its own, and `dpkg -x` unpacks with no install.
    """
    if shutil.which("apt-get") is None:
        raise ToolFailed("Chromium is missing system libraries, and this machine has no apt-get to fetch them.")
    state = BROWSER_LIBS_DIR / "apt"
    root = BROWSER_LIBS_DIR / "root"
    (state / "state" / "lists" / "partial").mkdir(parents=True, exist_ok=True)
    (state / "cache" / "archives" / "partial").mkdir(parents=True, exist_ok=True)
    root.mkdir(parents=True, exist_ok=True)
    apt = [
        "apt-get",
        "-o", f"Dir::State={state / 'state'}",
        "-o", "Dir::State::status=/var/lib/dpkg/status",
        "-o", f"Dir::Cache={state / 'cache'}",
        "-o", "Debug::NoLocking=1",
    ]
    run([*apt, "update", "--quiet"])
    run([*apt, "install", "--quiet", "--yes", "--download-only", "--no-install-recommends", *BROWSER_PACKAGES])
    for package in (state / "cache" / "archives").glob("*.deb"):
        run(["dpkg", "-x", package, root], quiet=True)
    # Chromium finds fonts through fontconfig, which reads the system directories only
    (BROWSER_LIBS_DIR / "fonts.conf").write_text(
        '<?xml version="1.0"?>\n<fontconfig>\n'
        f"  <dir>{root / 'usr/share/fonts'}</dir>\n"
        f"  <cachedir>{BROWSER_LIBS_DIR / 'fontcache'}</cachedir>\n"
        "</fontconfig>\n"
    )


def browser_environment() -> dict[str, str]:
    """Install headless Chromium, and say how to run it here."""
    env = {"PLAYWRIGHT_BROWSERS_PATH": str(BROWSERS_DIR)}
    npx("playwright", "install", "--only-shell", "chromium", env=env)
    browser = next(BROWSERS_DIR.glob("chromium_headless_shell-*/*/*headless*shell*"), None)
    if browser is None or not browser.is_file():
        raise ToolFailed(f"Playwright installed no headless shell under {BROWSERS_DIR}.")
    if not _missing_libraries(browser, env):
        return env
    say("Chromium is missing system libraries. Fetching them with no root.")
    _fetch_browser_libraries()
    library_dirs = [str(path) for path in (BROWSER_LIBS_DIR / "root").glob("usr/lib/*-linux-gnu")]
    library_dirs += [str(path) for path in (BROWSER_LIBS_DIR / "root").glob("lib/*-linux-gnu")]
    env["LD_LIBRARY_PATH"] = os.pathsep.join(library_dirs)
    env["FONTCONFIG_FILE"] = str(BROWSER_LIBS_DIR / "fonts.conf")
    missing = _missing_libraries(browser, env)
    if missing:
        raise ToolFailed(f"Chromium still cannot find: {', '.join(missing)}. Add the package to BROWSER_PACKAGES.")
    return env


def fetch_all() -> None:
    fetch_node()
    semver_tags_program()
    say(f"Node {NODE_VERSION} (npm {NODE_NPM_VERSION}) and semver-tags {SEMVER_TAGS_VERSION} are in {DEPENDENCY_DIR}.")
