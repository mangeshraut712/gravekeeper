#!/bin/sh
# Rebuilds public/restoration-kit.zip: everything needed to rerun the before/after check offline.
set -eu
cd "$(dirname "$0")/.."
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/kit/scripts" "$stage/kit/src/lib/restoration" "$stage/kit/third_party"
cp scripts/verify-restoration.mts "$stage/kit/scripts/"
cp src/lib/restoration/reverse.mts src/lib/restoration/fixtures.json "$stage/kit/src/lib/restoration/"
cp -R third_party/esrever "$stage/kit/third_party/"
cp LICENSE "$stage/kit/LICENSE-GRAVEKEEPER-MIT"
cat > "$stage/kit/README.txt" <<'TXT'
Gravekeeper restoration kit (esrever reverse() case 001)
Requires Node.js 22.18+. No install, no network.
  node scripts/verify-restoration.mts            # exit 0 when the restored version passes all fixtures
  node scripts/verify-restoration.mts --baseline # exit 1: the unchanged original fails new cases
Upstream: MIT, Mathias Bynens and contributors (third_party/esrever/upstream/LICENSE-MIT.txt).
Gravekeeper additions: MIT (LICENSE-GRAVEKEEPER-MIT).
TXT
rm -f public/restoration-kit.zip
(cd "$stage/kit" && find . -type f | sort | zip -X -q "$OLDPWD/public/restoration-kit.zip" -@)
unzip -l public/restoration-kit.zip
