"""Running one tool, in one place: an argument array, and never a shell string."""

from __future__ import annotations

import os
import shlex
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Sequence

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def say(message: str) -> None:
    print(f"==> {message}", flush=True)


def warn(message: str) -> None:
    print(f"==> {message}", file=sys.stderr, flush=True)


class ToolFailed(Exception):
    """The message is what a person needs to do next."""


@dataclass
class Result:
    exit_code: int
    stdout: str

    @property
    def ok(self) -> bool:
        return self.exit_code == 0


def run(
    command: Sequence[str],
    cwd: Path = REPOSITORY_ROOT,
    env: Mapping[str, str] | None = None,
    capture: bool = False,
    check: bool = True,
    quiet: bool = False,
    merge_stderr: bool = False,
) -> Result:
    """Run one command. `env` adds to the environment, so a secret stays out of the arguments."""
    command = [str(part) for part in command]
    if not quiet:
        say(shlex.join(command))
    finished = subprocess.run(
        command,
        cwd=cwd,
        env={**os.environ, **env} if env else None,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.STDOUT if merge_stderr else None,
    )
    if check and finished.returncode != 0:
        raise ToolFailed(f"`{shlex.join(command)}` exited {finished.returncode}.")
    return Result(finished.returncode, finished.stdout or "")
