#!/usr/bin/env bash

set -e

THISSCRIPT=$(basename $0)

PACKAGE_BASE="packages"
PACKAGE_DIR="${PACKAGE_BASE}/"
DRYRUN="false"

GITHUB_OUTPUT=${GITHUB_OUTPUT:-$(mktemp)}

# Modify for the help message
usage() {
  echo "${THISSCRIPT} command"
  echo "Executes the step command in the script."
  exit 0
}

fullrun() {
  # Build the semver-tags command based on inputs
  COMMAND_STRING="./semver-tags run " # --github_action "
  if [[ "${DRYRUN}" == "true" ]]; then
    COMMAND_STRING+="--dry_run "
  fi

  # This just adds all the package directories to the flags
  for dir in packages/*; do COMMAND_STRING+="--directories ${dir} "; done

  RESULT=$($COMMAND_STRING)

  # Parse the results out to get the versions we need to update and the release notes
  PUBLISHED=$(yq -P ".New_release_published" <<< $RESULT)
  NEW_TAGS=$(yq -P ".New_release_git_tag" <<< $RESULT)
  LAST_TAGS=$(yq -P ".Last_release_version" <<< $RESULT)
  JSON_RELEASE_NOTES=$(yq -P ".New_release_notes_json" <<< $RESULT)
  RUNDATE=$(date +"%Y-%m-%d-%T")

  PUBLISHED_ARRAY=($(echo $NEW_TAGS | tr "," "\n"))
  NEW_TAGS_ARRAY=($(echo $NEW_TAGS | tr "," "\n"))
  LAST_TAGS_ARRAY=($(echo $LAST_TAGS | tr "," "\n"))
  # This makes a run specific release not json file
  printf "$JSON_RELEASE_NOTES" > "release_notes/${RUNDATE}-release-notes.json"

  # We need to know what packages to actually publish to NPM
  NEEDS_NPM=""

  # For every new tag, update the package.json file so we can npm publish or whatnot
  for i in "${!NEW_TAGS_ARRAY[@]}"
  do
    if [[ "${PUBLISHED_ARRAY[i]}" == "false" ]]; then
      continue
    fi
    IFS='/' read -r DIR NEW_TAG <<< ${NEW_TAGS_ARRAY[i]}
    LAST_VERSION=${LAST_TAGS_ARRAY[i]}
    NEW_VERSION=${NEW_TAG#*v}
    NEEDS_NPM+="${PACKAGE_DIR}${DIR} "
    
    # Now update all the things
    # We use the "ci:" prefix because it doesn't count as a version bump
    # but we do need to tag all these and commit the changes. We could break this up to a second loop I guess.
    if [[ "${DRYRUN}" == "true" ]]; then
      echo "Would be changing version $LAST_VERSION to $NEW_VERSION in $PACKAGE_DIR$DIR/package.json"
      echo "Would run :"
      echo " > git add \"$PACKAGE_DIR$DIR/package.json\""
      echo " > git commit -m \"ci: adding version ${NEW_TAG} to $PACKAGE_DIR$DIR/package.json\""
      echo " > git tag ${NEW_TAGS_ARRAY[i]}"
    else
      echo "Changing version $LAST_VERSION to $NEW_VERSION in $PACKAGE_DIR$DIR/package.json"
      sed -i.bak "s/$LAST_VERSION/$NEW_VERSION/" "$PACKAGE_DIR$DIR/package.json"
      rm -rf "$PACKAGE_DIR$DIR/package.json.bak"
      git add "$PACKAGE_DIR$DIR/package.json"
      git commit -m "ci: adding version ${NEW_TAG} to $PACKAGE_DIR$DIR/package.json"
      git tag ${NEW_TAGS_ARRAY[i]}
    fi
  done
  echo "NEEDS_NPM=${NEEDS_NPM}" >> $GITHUB_OUTPUT
  
  if [[ "${DRYRUN}" == "true" ]]; then
    echo "Would git push here"
  else
    git push
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