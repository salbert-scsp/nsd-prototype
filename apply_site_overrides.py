#!/usr/bin/env python3
"""Re-apply the site-only changes to the pages copied from prototype-view. Safe to run repeatedly.

- noindex/nofollow meta on every HTML page
- the internal-review banner and its stylesheet link on the three dashboard pages
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DASHBOARDS = ["evolving.html", "emerging.html", "exposure.html"]
ALL_PAGES = DASHBOARDS + ["index.html"]

ROBOTS = '<meta name="robots" content="noindex, nofollow">'
CSS_LINK = '<link rel="stylesheet" href="assets/site.css">'
BANNER_TEXT = "Prototype for internal review: not for citation. Panels marked Sample use invented numbers."
# The masthead is inserted at the top of <body> by mountShell(), so the banner is inserted after it has run.
BANNER_SCRIPT = (
    '<script>document.body.insertAdjacentHTML("afterbegin",'
    '\'<div class="proto-banner" role="note"><p>' + BANNER_TEXT + '</p></div>\');</script>'
)


def patch(name):
    path = os.path.join(HERE, name)
    with open(path, encoding="utf-8") as fh:
        html = fh.read()
    if ROBOTS not in html:
        assert "</head>" in html, name
        html = html.replace("</head>", ROBOTS + "\n</head>", 1)
    if name in DASHBOARDS:
        if CSS_LINK not in html:
            html = html.replace("</head>", CSS_LINK + "\n</head>", 1)
        if BANNER_SCRIPT not in html:
            assert "</body>" in html, name
            html = html.replace("</body>", BANNER_SCRIPT + "\n</body>", 1)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(html)


if __name__ == "__main__":
    for page in ALL_PAGES:
        patch(page)
    print("Applied noindex meta to %d pages and the banner to %d." % (len(ALL_PAGES), len(DASHBOARDS)))
