#!/usr/bin/env bash
# Copy the five prototype files from prototype-scsp-view, re-apply the site-only changes (noindex),
# (previous/ is an archive and is never touched here), commit with the message you pass, and push.
# Usage: ./publish.sh "Commit message"
set -euo pipefail
[ $# -ge 1 ] && [ -n "$1" ] || { echo "Usage: $0 \"commit message\"" >&2; exit 1; }
SRC="${NSD_SRC:-$HOME/Documents/SkillsDashboard/prototype-scsp-view/prototype}"
cd "$(dirname "$0")"
FILES="evolving.html emerging.html exposure.html assets/nsd.css assets/nsd.js assets/scsp-logo.png"
for f in $FILES; do [ -f "$SRC/$f" ] || { echo "Missing $SRC/$f" >&2; exit 1; }; done
mkdir -p assets
for f in $FILES; do cp "$SRC/$f" "$f"; done
python3 apply_site_overrides.py                  # re-apply noindex and the banner, which the copy just overwrote
git add index.html publish.sh apply_site_overrides.py robots.txt $FILES   # only the site files, never anything else
if git diff --cached --quiet; then echo "Nothing changed; nothing to publish."; exit 0; fi
git commit -m "$1"
git push origin HEAD:main
