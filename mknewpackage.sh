#!/usr/bin/env bash

set -e

THISSCRIPT=$(basename $0)

usage() {
    echo "${THISSCRIPT} package-name"
    echo "Makes a new Zest package with the packagename ready to start dev."
}

if [ -z "$1" ]; then
    usage
    exit 0
fi

if [ -e "$1" ]; then
    echo "Can't create $1 as it already exists"
fi

PACKAGE_BASE="packages"
KEBABED=$(echo "$1" | sed 's/\([A-Z]\)/-\L\1/g;s/^-//')
ASTYPED=$1
PACKAGE_DIR="${PACKAGE_BASE}/${KEBABED}"

mkdir ${PACKAGE_DIR}

# Setup config stuff
cp templates/basic-package.json "${PACKAGE_DIR}/package.json"
cp templates/basic-tsconfig.json "${PACKAGE_DIR}/tsconfig.json"
cp templates/basic-jest.config.ts "${PACKAGE_DIR}/jest.config.ts"
cp templates/basic-vite.config.js "${PACKAGE_DIR}/vite.config.js"
cp templates/basic-README.md "${PACKAGE_DIR}/README.md"
sed -i.bak "s/REPLACEME/${ASTYPED}/" "${PACKAGE_DIR}/package.json"
sed -i.bak "s/KEBABME/${KEBABED}/" "${PACKAGE_DIR}/package.json"
sed -i.bak "s/REPLACEME/${ASTYPED}/" "${PACKAGE_DIR}/README.md"
sed -i.bak "s/KEBABME/${KEBABED}/" "${PACKAGE_DIR}/README.md"
sed -i.bak "s/REPLACEME/${ASTYPED}/" "${PACKAGE_DIR}/vite.config.js"
sed -i.bak "s/KEBABME/${KEBABED}/" "${PACKAGE_DIR}/vite.config.js"

# Setup actual code
cp -a templates/template-src "${PACKAGE_DIR}/src"
sed -i.bak "s/REPLACEME/${ASTYPED}/g" "${PACKAGE_DIR}/src/index.ts"
cp -a templates/template-tests "${PACKAGE_DIR}/__tests__"
sed -i.bak "s/REPLACEME/${ASTYPED}/g" "${PACKAGE_DIR}/__tests__/basic.spec.ts"


# Clean up
rm -rf "${PACKAGE_DIR}"/*.bak
rm -f "${PACKAGE_DIR}"/src/*.bak
rm -f "${PACKAGE_DIR}"/__tests__/*.bak

