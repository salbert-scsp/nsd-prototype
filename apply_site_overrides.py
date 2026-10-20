#!/usr/bin/env python3
"""Re-apply the site-only changes to the pages copied from prototype-view. Safe to run repeatedly.

- noindex/nofollow meta on every HTML page
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ALL_PAGES = ["evolving.html", "emerging.html", "exposure.html", "index.html"]

ROBOTS = '<meta name="robots" content="noindex, nofollow">'


def patch(name):
    path = os.path.join(HERE, name)
    with open(path, encoding="utf-8") as fh:
        html = fh.read()
    if ROBOTS not in html:
        assert "</head>" in html, name
        html = html.replace("</head>", ROBOTS + "\n</head>", 1)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(html)


if __name__ == "__main__":
    for page in ALL_PAGES:
        patch(page)
    print("Applied noindex meta to %d pages." % len(ALL_PAGES))
