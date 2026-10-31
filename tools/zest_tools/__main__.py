"""The verbs. `tools.sh` calls this, and so does each Reactorcide job."""

from __future__ import annotations

import sys

from . import checks, commits, deps, release
from .commands import ToolFailed, warn

USAGE = """\
tools.sh <verb>

  check                   Each check that a pull request must pass
  test                    Unit tests, headless, in jsdom
  test-e2e                Browser tests, in headless Chromium. Fetches the browser,
                          and with no root it fetches the libraries too
  test-build              Build the demo and each package
  test-tools              The tests of this tooling
  audit                   Fail on an advisory in what a consumer installs
  deps                    Fetch the pinned Node and semver-tags into .deps

  commits check [<base>]  Fail when a commit does not say what kind of change it is

  release plan            Say what the next release would be. Changes nothing
  release first-publish   Pack each package that npm does not have, and print what
                          a maintainer runs. Publishes nothing

  The release job runs these. Each one refuses without ZEST_RELEASE=1:
  release stamp           Write the computed versions. No commit
  release pack            Build and check the tarballs
  release tag             Commit, tag, and push in one atomic operation
"""

VERBS = {
    ("check",): checks.everything,
    ("test",): checks.test_unit,
    ("test-e2e",): checks.test_e2e,
    ("test-build",): checks.test_build,
    ("test-tools",): checks.test_tools,
    ("audit",): checks.audit,
    ("deps",): deps.fetch_all,
    ("commits", "check"): commits.check,
    ("release", "plan"): release.plan_report,
    ("release", "first-publish"): release.first_publish,
    ("release", "stamp"): release.stamp,
    ("release", "pack"): release.pack,
    ("release", "tag"): release.tag,
}


def main(arguments: list[str]) -> int:
    for length in (2, 1):
        verb = VERBS.get(tuple(arguments[:length]))
        if verb and (len(arguments) == length or arguments[:2] == ["commits", "check"]):
            try:
                verb(*arguments[length:])
            except ToolFailed as failure:
                warn(str(failure))
                return 1
            return 0
    print(USAGE, end="")
    return 0 if arguments[:1] in ([], ["help"], ["--help"]) else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
