#!/usr/bin/env bash
# Copy the prototype files from prototype-scsp-view, re-apply the site-only changes (noindex), stamp the asset links with a version (cache-busting),
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
python3 - <<'PY'                                # cache-busting: ?v=<hash of nsd.css + nsd.js> on the asset links, so browsers reload changed files
import hashlib, re
v = hashlib.md5(open("assets/nsd.css", "rb").read() + open("assets/nsd.js", "rb").read()).hexdigest()[:8]
for page in ("evolving.html", "emerging.html", "exposure.html"):
    html = open(page, encoding="utf-8").read()
    new = re.sub(r'(assets/nsd\.(?:css|js))(?:\?v=\w+)?"', lambda m: m.group(1) + "?v=" + v + '"', html)
    open(page, "w", encoding="utf-8").write(new)
print("Asset version", v)
PY
git add index.html publish.sh apply_site_overrides.py robots.txt $FILES   # only the site files, never anything else
if git diff --cached --quiet; then echo "Nothing changed; nothing to publish."; exit 0; fi
git commit -m "$1"
git push origin HEAD:main
