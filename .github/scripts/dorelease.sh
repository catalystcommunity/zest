#!/usr/bin/env bash

set -e

THISSCRIPT=$(basename $0)

PACKAGE_BASE="packages"
PACKAGE_DIR="${PACKAGE_BASE}/"
DRYRUN="false"

# Modify for the help message
usage() {
  echo "${THISSCRIPT} command"
  echo "Executes the step command in the script."
  exit 0
}

fullrun() {
  if [[ "${DRYRUN}" == "true" ]]; then
    echo "Executed fullrun with dryrun"
  else
    echo "Executed fullrun without dryrun"
  fi
}

# This one calls another thing!
dryrun() {
  DRYRUN="true"
  fullrun "$@"
}

# This should be last in the script, all other functions are named beforehand.
case "$1" in
  "dryrun")
    shift
    dryrun
    ;;
  "fullrun")
    shift
    fullrun
    ;;
  *)
    usage
    ;;
esac

exit 0