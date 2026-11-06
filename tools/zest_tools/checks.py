"""The checks that a pull request must pass. Each one installs what it reads, because
each job runs in a clean workspace of its own."""

from __future__ import annotations

import os
import unittest

from . import deps
from .commands import REPOSITORY_ROOT, ToolFailed, say, warn


def install() -> None:
    deps.npm("ci", "--no-audit", "--no-fund")


def test_unit() -> None:
    install()
    deps.npm("test")


def test_build() -> None:
    install()
    deps.npm("run", "build")
    deps.npm("run", "build:packages")


def site_build() -> None:
    """Build the demo site into website/root, from the packages in this repository."""
    install()
    deps.npm("run", "build", "--", "--outDir", str(REPOSITORY_ROOT / "website" / "root"), "--emptyOutDir")
    for path in ("index.html", "gallery/index.html", "examples/desktop/index.html"):
        page = REPOSITORY_ROOT / "website" / "root" / path
        if not page.is_file() or page.stat().st_size == 0:
            raise ToolFailed(f"website/root/{path} is missing or empty after the build.")
    say("The site is in website/root.")


def test_e2e() -> None:
    install()
    env = deps.browser_environment()
    deps.npm("run", "test:e2e", env={**env, "CI": "1"})


def test_tools() -> None:
    suite = unittest.defaultTestLoader.discover(
        str(REPOSITORY_ROOT / "tools" / "tests"), top_level_dir=str(REPOSITORY_ROOT / "tools")
    )
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    if not result.wasSuccessful():
        raise ToolFailed("The tooling tests failed.")


def audit() -> None:
    """A published package must have no known advisory in what it installs.

    The development tools only report here. They never reach a consumer, and an
    advisory published this morning must not fail a pull request that changes a
    README.
    """
    install()
    deps.npm("audit", "--omit=dev")
    result = deps.npm("audit", check=False)
    if not result.ok:
        warn("The development tools have an advisory. This does not fail the job. Update them soon.")
    say("No advisory in what a consumer installs.")


def everything() -> None:
    test_tools()
    test_unit()
    test_build()
    test_e2e()
    audit()
