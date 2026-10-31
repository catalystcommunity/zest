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

PACKAGE_BASE="packages"
KEBABED=$(echo "$1" | sed 's/\([A-Z]\)/-\L\1/g;s/^-//')
ASTYPED=$1
PACKAGE_DIR="${PACKAGE_BASE}/${KEBABED}"

if [ -e "${PACKAGE_DIR}" ]; then
    echo "Can't create ${PACKAGE_DIR} as it already exists"
    exit 1
fi

mkdir ${PACKAGE_DIR}

# Setup config stuff
cp templates/basic-package.json "${PACKAGE_DIR}/package.json"
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
sed -i.bak "s/REPLACEME/${ASTYPED}/g" "${PACKAGE_DIR}/src/index.js"
cp -a templates/template-tests "${PACKAGE_DIR}/__tests__"
sed -i.bak "s/REPLACEME/${ASTYPED}/g" "${PACKAGE_DIR}/__tests__/basic.spec.js"


# Clean up
rm -rf "${PACKAGE_DIR}"/*.bak
rm -f "${PACKAGE_DIR}"/src/*.bak
rm -f "${PACKAGE_DIR}"/__tests__/*.bak

echo "Created ${PACKAGE_DIR}. To finish:"
echo "  1. Run: npm install"
echo "  2. Export it from src/index.js, and add it to the dependencies in the root package.json."
echo "  3. Add a section for it to demo/gallery.js."
echo "npm test and npm run test:e2e fail until you do steps 2 and 3."
echo "A maintainer publishes a new package one time, by hand: ./tools.sh release first-publish"
