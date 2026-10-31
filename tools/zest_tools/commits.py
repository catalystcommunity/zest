"""Refuse a commit that does not say what kind of change it is.

The version is computed from these subjects, so a subject that matches nothing
is a release that does not happen for a reason nobody sees.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

from .commands import ToolFailed, run, say

#: A minor release.
MINOR_TYPES = ("feat",)

#: A patch release. These are a shorter list than the semver-tags default, because
#: each released package waits for a person to approve it with 2FA. A change that
#: a consumer cannot see must not ask for that. `release.py` gives this list to
#: semver-tags, and a test holds them together.
PATCH_TYPES = ("fix", "perf", "revert")

#: Correct commits that move no version.
NO_RELEASE_TYPES = ("build", "chore", "ci", "docs", "norelease", "refactor", "style", "test")

ALL_TYPES = (*MINOR_TYPES, *PATCH_TYPES, *NO_RELEASE_TYPES)

BREAKING_MARKER = "BREAKING CHANGE"

SUBJECT = re.compile(r"^(?P<type>[a-z]+)(?P<scope>\([^)]+\))?(?P<breaking>!)?: (?P<subject>.+)$")


@dataclass(frozen=True)
class Commit:
    hash: str
    subject: str
    body: str = ""

    @property
    def kind(self) -> str:
        match = SUBJECT.match(self.subject)
        return match.group("type") if match else ""

    @property
    def conventional(self) -> bool:
        return self.kind in ALL_TYPES

    @property
    def effect(self) -> str:
        if not self.conventional:
            return "refused"
        match = SUBJECT.match(self.subject)
        if match.group("breaking") or BREAKING_MARKER in self.body:
            return "major"
        if self.kind in MINOR_TYPES:
            return "minor"
        if self.kind in PATCH_TYPES:
            return "patch"
        return "no release"


def _base(base: str | None) -> str:
    """Reactorcide names the base of a pull request. A person gets the merge base with main."""
    if base:
        return base
    from_ci = os.environ.get("REACTORCIDE_DIFF_BASE", "").strip()
    if from_ci:
        return from_ci
    for candidate in ("origin/main", "main"):
        found = run(["git", "merge-base", candidate, "HEAD"], capture=True, check=False, quiet=True)
        if found.ok and found.stdout.strip():
            return found.stdout.strip()
    raise ToolFailed("There is no main to compare against. Name a base: `./tools.sh commits check <base>`.")


def read_commits(base: str | None = None) -> list[Commit]:
    # Separators that cannot be in a subject, so that a body with blank lines stays one commit
    log = run(
        ["git", "log", f"{_base(base)}..HEAD", "--pretty=format:%H%x1f%s%x1f%b%x1e"],
        capture=True,
        quiet=True,
    )
    commits = []
    for record in log.stdout.split("\x1e"):
        parts = record.strip("\n").split("\x1f")
        if len(parts) == 3:
            commits.append(Commit(*parts))
    return commits


def check(base: str | None = None) -> None:
    commits = read_commits(base)
    if not commits:
        say("This branch adds no commit, so there is nothing to check.")
        return
    for commit in commits:
        print(f"  {commit.hash[:12]} {commit.effect:>10}  {commit.subject}", flush=True)
    refused = [commit for commit in commits if not commit.conventional]
    if refused:
        raise ToolFailed(
            f"{len(refused)} of {len(commits)} commits do not say what kind of change they are. "
            "Write `type: subject`, or `type(scope)!: subject` for a breaking change.\n"
            f"  Types that release: {', '.join((*MINOR_TYPES, *PATCH_TYPES))}.\n"
            f"  Types that do not: {', '.join(NO_RELEASE_TYPES)}."
        )
    say(f"{len(commits)} commits are conventional.")
