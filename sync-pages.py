#!/usr/bin/env python3
"""Copy index.html to about/portfolio/lineage and stamp each file's title,
description, and canonical (and matching OG/Twitter/h1 text).

  python3 sync-pages.py

Do not use a bare `cp index.html about.html` — the inner pages would keep
the homepage canonical and description.
"""
from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parent
BASE = "https://rothbardcapitalpartners.com"
OG = BASE + "/assets/og-cover.jpg"

PAGES = {
    "index.html": {
        "title": "Rothbard Capital",
        "url": BASE + "/",
        "description": (
            "Rothbard Capital backs early-stage entrepreneurs wielding foundational "
            "technology and knowledge to beat uncertainty and produce novel value for society."
        ),
    },
    "about.html": {
        "title": "About · Rothbard Capital",
        "url": BASE + "/about",
        "description": (
            "About Rothbard Capital. Early-stage investors backing entrepreneurs who wield "
            "foundational technology and knowledge to produce novel value for society."
        ),
    },
    "portfolio.html": {
        "title": "Portfolio · Rothbard Capital",
        "url": BASE + "/portfolio",
        "description": (
            "The Rothbard Capital portfolio — early-stage companies whose founders wield "
            "foundational technology and knowledge to produce novel value for society."
        ),
    },
    "lineage.html": {
        "title": "Lineage · Rothbard Capital",
        "url": BASE + "/lineage",
        "description": (
            "Rothbard Capital’s character and temperament spring from the Austrian Economic "
            "Tradition — the intellectual lineage that shapes how we back founders."
        ),
    },
}

def stamp(html: str, meta: dict) -> str:
    title, url, desc = meta["title"], meta["url"], meta["description"]
    h1 = "Rothbard Capital"  # brand heading stays the firm name on every page
    html = re.sub(r"<title>[^<]*</title>", f"<title>{title}</title>", html, count=1)
    html = re.sub(
        r'(<meta name="description" content=")[^"]*(">)',
        rf"\g<1>{desc}\2", html, count=1)
    html = re.sub(
        r'(<link rel="canonical" href=")[^"]*(">)',
        rf"\g<1>{url}\2", html, count=1)
    html = re.sub(
        r'(<meta property="og:title" content=")[^"]*(">)',
        rf"\g<1>{title}\2", html, count=1)
    html = re.sub(
        r'(<meta property="og:description" content=")[^"]*(">)',
        rf"\g<1>{desc}\2", html, count=1)
    html = re.sub(
        r'(<meta property="og:url" content=")[^"]*(">)',
        rf"\g<1>{url}\2", html, count=1)
    html = re.sub(
        r'(<meta name="twitter:title" content=")[^"]*(">)',
        rf"\g<1>{title}\2", html, count=1)
    html = re.sub(
        r'(<meta name="twitter:description" content=")[^"]*(">)',
        rf"\g<1>{desc}\2", html, count=1)
    # visually-hidden copy for crawlers
    html = re.sub(r"(<div class=\"seo-only\">\s*<h1>)[^<]*(</h1>\s*<p>)[^<]*(</p>)",
                  rf"\g<1>{h1}\2{desc}\3", html, count=1)
    return html

def main():
    src = ROOT / "index.html"
    raw = src.read_text()
    # First stamp the homepage itself (in case it was edited by hand)
    src.write_text(stamp(raw, PAGES["index.html"]))
    raw = src.read_text()
    for name, meta in PAGES.items():
        if name == "index.html":
            continue
        (ROOT / name).write_text(stamp(raw, meta))
        print("wrote", name, "→", meta["title"])
    print("ok")

if __name__ == "__main__":
    main()
