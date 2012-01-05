#!/bin/bash
set -e

if [ -n "$1" ]; then
    RELEASE="tags/$1"
    TARGET="$(pwd)/$1.xpi"
else
    RELEASE="HEAD"
    TARGET="$(pwd)/samltracer.xpi"
fi

if ! git rev-parse --verify "$RELEASE" >/dev/null 2>&1; then
    echo "Invalid revision: $RELEASE" >&2
    exit 1
fi

D=$(mktemp -d)

git archive --format tar "$RELEASE" | (cd "$D"; tar xv)

cd "$D/chrome"

for F in *; do
    if [ ! -d "$F" ]; then
	continue
    fi
    pushd "$F"
    zip -r "../$F.jar" *
    popd
    rm -r "$F"
done

cd "$D"

rm "build.sh"
sed 's@chrome/samltrace/@jar:chrome/samltrace.jar!/@' <"chrome.manifest" >"chrome.manifest.new"
mv -f "chrome.manifest.new" "chrome.manifest"

zip -r "$TARGET" *

cd /
rm -r "$D"
