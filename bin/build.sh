#!/bin/bash

set -e

CWD="$(pwd)"

HLJS_VERSION=11.11.1
PAKO_VERSION=2.1.0

if [ -n "$1" ]; then
    RELEASE="tags/$1"
    TARGET="/tmp/$1.zip"
else
    RELEASE="HEAD"
    TARGET="/tmp/samltracer.zip"
fi

if ! git rev-parse --verify "$RELEASE" >/dev/null 2>&1; then
    echo "Invalid revision: $RELEASE" >&2
    exit 1
fi

# Build Highlight.js
HLJS=$(mktemp -d)
cd "$HLJS"
git clone --depth 1 -b "$HLJS_VERSION" https://github.com/highlightjs/highlight.js.git
cd highlight.js

npm install --package-lock-only
npm clean-install
npm run build
node tools/build.js xml properties http

# Build Pako
PAKO=$(mktemp -d)
cd "$PAKO"
git clone --depth 1 -b "$PAKO_VERSION" https://github.com/nodeca/pako.git
cd pako

npm install --package-lock-only
npm clean-install
npm run build

DEST=$(mktemp -d)
cd $CWD
cp -R $CWD/. $DEST
cd $DEST

# Copy dependencies
cp "$HLJS/highlight.js/build/highlight.min.js" "$DEST/lib/"
cp "$PAKO/pako/dist/pako_inflate.min.js" "$DEST/lib/"

# Clean release
grep export-ignore .gitattributes | cut -d ' ' -f 1 | while IFS= read -r line
do
  rm -rf "$line"
done

git archive --format tar "$RELEASE" | (cd "$DEST"; tar xv)

cd "$DEST"

zip -1 -r "$TARGET" *

cd /
rm -rf "$DEST"
rm -rf "$HLJS"
rm -rf "$PAKO"
