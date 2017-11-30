#!/bin/bash
set -e

if [ -n "$1" ]; then
    RELEASE="tags/$1"
    TARGET="$(pwd)/$1.zip"
else
    RELEASE="HEAD"
    TARGET="$(pwd)/samltracer.zip"
fi

if ! git rev-parse --verify "$RELEASE" >/dev/null 2>&1; then
    echo "Invalid revision: $RELEASE" >&2
    exit 1
fi

D=$(mktemp -d)

git archive --format zip "$RELEASE" | (cd "$D"; tar xv)

cd "$D"

rm "build.sh"

zip -r "$TARGET" *

cd /
rm -r "$D"
