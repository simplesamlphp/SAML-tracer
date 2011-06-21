#!/bin/bash
set -e

D=$(mktemp -d)

git archive --format tar HEAD | (cd "$D"; tar xv)

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
sed -i 's@chrome/samltrace/@jar:chrome/samltrace.jar!/@' "chrome.manifest"

zip -r /tmp/samltrace.xpi *

cd /
rm -r "$D"
