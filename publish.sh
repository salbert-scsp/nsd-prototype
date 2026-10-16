#!/usr/bin/env bash
# Copy the five prototype files from prototype-view, commit with the message you pass, and push.
# Usage: ./publish.sh "Commit message"
set -euo pipefail
[ $# -ge 1 ] && [ -n "$1" ] || { echo "Usage: $0 \"commit message\"" >&2; exit 1; }
SRC="${NSD_SRC:-$HOME/Documents/SkillsDashboard/prototype-view/prototype}"
cd "$(dirname "$0")"
FILES="evolving.html emerging.html exposure.html assets/nsd.css assets/nsd.js"
for f in $FILES; do [ -f "$SRC/$f" ] || { echo "Missing $SRC/$f" >&2; exit 1; }; done
mkdir -p assets
for f in $FILES; do cp "$SRC/$f" "$f"; done
git add index.html publish.sh $FILES            # only the site files, never anything else
if git diff --cached --quiet; then echo "Nothing changed; nothing to publish."; exit 0; fi
git commit -m "$1"
git push origin HEAD:main
