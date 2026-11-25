#!/usr/bin/env python3
"""Render the Sea Glass pricing deck to a PDF.

Usage:
    python3 render.py deck.html out.pdf [--png DIR]

deck.html must sit next to its img/ folder (and fonts/, if vendored).
--png DIR also writes one PNG per page to DIR, for checking each page by eye.

Needs Playwright with Chromium: pip install playwright && playwright install chromium.
If Chromium lives somewhere else, set CHROMIUM_PATH to its executable.
"""
import argparse
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

PAGE_W_PX, PAGE_H_PX = 816, 1056  # 8.5in x 11in at 96 dpi


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", help="deck.html")
    ap.add_argument("out", help="output PDF path")
    ap.add_argument("--png", metavar="DIR", help="also write page PNGs here")
    args = ap.parse_args()

    deck = Path(args.deck).resolve()
    if not deck.is_file():
        sys.exit(f"Not found: {deck}")
    out = Path(args.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)

    launch = {"args": ["--no-sandbox"]}
    if os.environ.get("CHROMIUM_PATH"):
        launch["executable_path"] = os.environ["CHROMIUM_PATH"]

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(**launch)
        except Exception as e:
            sys.exit("Could not start Chromium. Run 'playwright install chromium', or set CHROMIUM_PATH "
                     "to a Chrome or Chromium executable.\n" + str(e).splitlines()[0])
        page = browser.new_page(viewport={"width": PAGE_W_PX, "height": PAGE_H_PX})
        page.goto(deck.as_uri(), wait_until="networkidle", timeout=60000)
        # Fonts and every image must be in before printing, or Chrome prints fallbacks and blanks.
        page.evaluate("document.fonts.ready")
        missing = page.evaluate(
            """() => {
                const bad = [];
                for (const img of document.images) if (!img.complete || img.naturalWidth === 0) bad.push(img.getAttribute('src'));
                for (const el of document.querySelectorAll('[style*="background-image"], .collage, .map, .bg')) {
                    const m = getComputedStyle(el).backgroundImage.match(/url\\("?(.*?)"?\\)/);
                    if (m) bad.push('bg:' + m[1]);
                }
                return bad;
            }"""
        )
        broken = [m for m in missing if not m.startswith("bg:")]
        bg_files = [m[3:] for m in missing if m.startswith("bg:")]
        for url in bg_files:
            path = Path(url.replace("file://", "")) if url.startswith("file://") else deck.parent / url
            if not path.exists():
                broken.append(url)
        if broken:
            print("Missing images:\n  " + "\n  ".join(sorted(set(broken))), file=sys.stderr)

        fams = page.evaluate("[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family)")
        for want in ("Playfair Display", "Montserrat"):
            if not any(want in f for f in fams):
                print(f"Warning: {want} did not load; the PDF uses a fallback font. Vendor the fonts in fonts/ or check the network.", file=sys.stderr)

        page.pdf(path=str(out), width="8.5in", height="11in", print_background=True, prefer_css_page_size=True)
        n = page.evaluate("document.querySelectorAll('section.page').length")
        print(f"Wrote {out} ({n} pages)")

        if args.png:
            d = Path(args.png)
            d.mkdir(parents=True, exist_ok=True)
            page.emulate_media(media="print")
            sections = page.query_selector_all("section.page")
            for i, s in enumerate(sections, 1):
                s.screenshot(path=str(d / f"page-{i:02d}.png"))
            print(f"Wrote {len(sections)} PNGs to {d}")
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
