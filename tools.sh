#!/usr/bin/env bash
# The front door for the verbs that CI runs. A person types this too, so that a
# local run and a CI run cannot drift. It holds no logic: every verb goes to a
# Python module under tools/.
#
# Everyday development does not need this. See `npm run` and the README.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v uv >/dev/null 2>&1; then
    echo "tools.sh needs uv, and it is not on the path." >&2
    echo "Install it from https://docs.astral.sh/uv/ and run this again." >&2
    exit 1
fi

export PYTHONPATH="$ROOT/tools"
exec uv run --quiet --no-project --python ">=3.11" python -m zest_tools "$@"
