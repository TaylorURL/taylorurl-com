#!/usr/bin/env python3
"""Normalise every client site's icon into one set the console can draw.

A favicon arrives as whatever its site happens to serve: a 16px ICO, a 512px
PNG, an SVG, a photograph, artwork on a transparent ground, the same artwork
baked onto a white square, or nothing at all. Drawn straight into a column at
twenty pixels those are not a set, and no filter fixes them - grey leaves a
photograph muddy, and a silhouette turns a baked white square into a solid black
block while making white artwork vanish.

So the treatment happens once, here, rather than on every render. Each icon is
fetched from the link the site itself declares, the ground it was baked onto is
lifted back to transparency, the artwork is trimmed to its own bounds and
centred on a square, and the result is written as a 64px PNG with an alpha
channel. What the console then draws is one shape per site on nothing, which is
the only input a silhouette or a tint can be applied to safely.

The studio's own domains take the studio's own mark, because the site serves no
icon at its root and a lettered tile for the company whose console this is
reads as an oversight.

    python3 scripts/capture-site-icons.py            # every site in the list
    python3 scripts/capture-site-icons.py --check    # report, write nothing

Re-run it when a site is added or rebrands. A host it cannot reach keeps
whatever is already committed rather than losing its icon to one bad morning.
"""

import argparse
import io
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "site-icons"

# The mark drawn for the studio's own domains, which serve none of their own.
OWN_MARK = ROOT / "public" / "images" / "taylorurl-mark.png"
OWN_HOSTS = {"taylorurl.com", "baytownwebdevelopment.com"}

SIZE = 64
# Room left around the artwork so a square mark and a wide one both sit inside
# the tile rather than one touching its edges.
PAD = 4
TIMEOUT = 12
AGENT = "Mozilla/5.0 (compatible; TaylorURL-icons/1.0)"

# Where a site says its icon is, best first. A site declaring several sizes is
# read for the largest, since scaling down keeps detail and scaling up invents
# it.
LINK = re.compile(
    r"""<link\s+[^>]*rel=["']([^"']*\bicon\b[^"']*)["'][^>]*>""",
    re.I,
)
ATTR = re.compile(r"""(\w[\w-]*)\s*=\s*["']([^"']*)["']""")


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as answer:
        return answer.read(), answer.headers.get("Content-Type", "")


def declared(host):
    """Every icon URL the site's own markup names, largest first."""
    found = []
    for scheme in ("https://www.", "https://"):
        try:
            body, _ = fetch(f"{scheme}{host}/")
        except (urllib.error.URLError, OSError, ValueError):
            continue
        page = body.decode("utf-8", "ignore")
        base = f"{scheme}{host}/"
        for match in LINK.finditer(page):
            attrs = dict((k.lower(), v) for k, v in ATTR.findall(match.group(0)))
            href = attrs.get("href")
            if not href:
                continue
            sizes = attrs.get("sizes", "")
            edge = 0
            if "x" in sizes:
                try:
                    edge = int(sizes.lower().split("x")[0])
                except ValueError:
                    edge = 0
            found.append((edge, urllib.parse.urljoin(base, href)))
        if found:
            break
    found.sort(key=lambda row: -row[0])
    # The conventional paths are tried after anything declared, because a site
    # that names its icon means that one.
    tail = [f"https://{host}/favicon.png", f"https://{host}/favicon.ico"]
    return [url for _, url in found] + tail


def opened(raw):
    """The bitmap, or None where the bytes are not one this can draw."""
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except Exception:
        return None
    # An ICO holds several sizes; Pillow opens the first, which is rarely the
    # largest.
    if getattr(image, "n_frames", 1) > 1 and image.format == "ICO":
        best, edge = image, 0
        for size in sorted(getattr(image, "ico", None).sizes() if hasattr(image, "ico") else []):
            if size[0] > edge:
                edge = size[0]
                try:
                    best = image.ico.getimage(size)
                except Exception:
                    pass
        image = best
    return image.convert("RGBA")


def lift_ground(image):
    """Return the artwork with an opaque background lifted to transparency.

    A mark baked onto a white square is the same mark with a rectangle behind
    it, and the rectangle is the thing that ruins a column of them. Where every
    corner agrees on one near-solid colour, that colour is read as the ground
    and cleared - flood filled from the edges, so a white shape inside the
    artwork is kept while the field around it goes.
    """
    width, height = image.size
    corners = [
        image.getpixel((0, 0)),
        image.getpixel((width - 1, 0)),
        image.getpixel((0, height - 1)),
        image.getpixel((width - 1, height - 1)),
    ]
    if any(pixel[3] < 250 for pixel in corners):
        return image
    first = corners[0][:3]
    if any(max(abs(a - b) for a, b in zip(first, pixel[:3])) > 12 for pixel in corners):
        return image

    pixels = image.load()
    seen = set()
    stack = [(x, 0) for x in range(width)]
    stack += [(x, height - 1) for x in range(width)]
    stack += [(0, y) for y in range(height)]
    stack += [(width - 1, y) for y in range(height)]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < width and 0 <= y < height):
            continue
        seen.add((x, y))
        pixel = pixels[x, y]
        if pixel[3] < 250:
            continue
        if max(abs(a - b) for a, b in zip(first, pixel[:3])) > 24:
            continue
        pixels[x, y] = (pixel[0], pixel[1], pixel[2], 0)
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return image


def normalise(image):
    """Trim to the artwork and centre it on a square with room around it."""
    image = lift_ground(image)
    box = image.getbbox()
    if box:
        image = image.crop(box)
    inner = SIZE - PAD * 2
    width, height = image.size
    if not width or not height:
        return None
    scale = min(inner / width, inner / height)
    image = image.resize(
        (max(1, round(width * scale)), max(1, round(height * scale))), Image.LANCZOS
    )
    tile = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    tile.paste(image, ((SIZE - image.width) // 2, (SIZE - image.height) // 2), image)
    return tile


def ground_for(tile):
    """Which ground this mark needs under it: 'dark' or 'light'.

    A logo drawn in pale ink - a white wordmark, a light monogram - is invisible
    on the near-white a card uses, and one drawn in dark ink disappears on a
    dark slab. Neither is a fault in the artwork and neither can be fixed by
    changing the mark, so the tile changes instead, once per icon, decided from
    what the artwork actually is rather than from a rule applied to all of them.

    Only pixels a reader can see are weighed. A mark is mostly transparency at
    this size, and averaging the empty field around it would call every one of
    them light.
    """
    visible = [pixel for pixel in tile.getdata() if pixel[3] > 40]
    if not visible:
        return "light"
    luminance = sum(
        0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b, _ in visible
    ) / len(visible)
    return "dark" if luminance > 170 else "light"


def hosts():
    """The sites the console lists, read from the file the console reads."""
    source = ROOT / "src" / "app" / "data" / "siteIcons.js"
    if source.exists():
        return re.findall(r"'([a-z0-9.-]+\.[a-z]{2,})'", source.read_text())
    return []


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("hosts", nargs="*")
    args = parser.parse_args()

    targets = args.hosts or hosts()
    if not targets:
        print("no hosts given and none listed in src/app/data/siteIcons.js")
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    written, kept, missing = 0, 0, []
    grounds = {}

    for host in targets:
        target = OUT / f"{host}.png"
        if host in OWN_HOSTS:
            tile = normalise(Image.open(OWN_MARK).convert("RGBA"))
            source = "the studio's own mark"
        else:
            tile, source = None, None
            for url in declared(host):
                try:
                    raw, kind = fetch(url)
                except (urllib.error.URLError, OSError, ValueError):
                    continue
                if "svg" in kind or url.endswith(".svg"):
                    continue
                image = opened(raw)
                if image is None:
                    continue
                tile = normalise(image)
                if tile is not None:
                    source = url
                    break

        if tile is None:
            if target.exists():
                kept += 1
                print(f"  {host}: unreachable, keeping the committed icon")
            else:
                missing.append(host)
                print(f"  {host}: no icon found")
            continue

        grounds[host] = ground_for(tile)
        print(f"  {host}: from {source} ({grounds[host]} ground)")
        if not args.check:
            tile.save(target, "PNG", optimize=True)
            written += 1

    dark = sorted(host for host, ground in grounds.items() if ground == "dark")
    if grounds:
        print("\nDARK_GROUND, for src/app/data/siteIcons.js:")
        print("  " + (", ".join(f"'{host}'" for host in dark) if dark else "(none)"))

    print(f"\n{written} written, {kept} kept, {len(missing)} without an icon")
    if missing:
        print("These draw a lettered tile: " + ", ".join(missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
