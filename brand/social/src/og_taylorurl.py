"""The share card taylorurl.com hands to Slack, iMessage, LinkedIn and Facebook.

`public/og.png` was drawn by hand and nothing in the tree could redraw it, so
the one image every link to the site unfurls as was fixed at whatever it said
the day it was made. The geometry below is that card measured off itself - the
96-pixel grid, the 84-pixel margin, the blue rule and mono caps at the top, the
headline and the two lines under it, the hairline and the wordmark and the
domain at the foot, and the glow that lifts the bottom-right corner off the
slab - so a rebuild lands where the drawn card landed and the words are the part
that can move.

The furniture is shared from here. `og_taylorwebsite.py` draws the sister site's
card on the same grid, margin, rule and type and reads them off this file rather
than keeping a second copy: two cards read as one company only if the furniture
does not move, and a fitted falloff written down twice goes out of step the
first time either copy is touched.

    python3 brand/social/src/og_taylorurl.py public/og.png
"""

import sys

from PIL import Image, ImageDraw

from tulib import BLUE_BRIGHT, SLAB, SLAB_INK, SS, Canvas, font

W, H = 1200, 630

# The margin every element is set from, and the rule the grid runs on. Both are
# read off the drawn card rather than chosen: the hairline above the footer runs
# from 84 to 1116, and the grid lines fall on multiples of 96 from the top left
# corner.
MARGIN = 84
GRID = 96

# The corner glow. A flat ground would be a different card, and this one is slab
# everywhere except the bottom right, where it lifts to a deep blue. The falloff
# is a smootherstep over an ellipse anchored on that corner, fitted to the
# published card at a root-mean-square error of about three levels out of the
# sixty-four the blue channel travels, which is under what a screen resolves.
# The three figures are what the glow adds to the ground rather than the colour
# it arrives at, so the lift stays the same whatever the sheet under it is.
GLOW = (12, 27, 64)
GLOW_RX, GLOW_RY = 1000, 650


def ground():
    """The slab and its corner glow, at delivered size."""
    im = Image.new("RGB", (W, H), SLAB)
    px = im.load()
    for y in range(H):
        dy = ((H - 1 - y) / GLOW_RY) ** 2
        for x in range(W):
            dx = ((W - 1 - x) / GLOW_RX) ** 2
            u = 1 - (dx + dy) ** 0.5
            if u <= 0:
                continue
            t = u * u * u * (u * (u * 6 - 15) + 10)
            px[x, y] = tuple(min(255, round(base + lift * t))
                             for base, lift in zip(SLAB, GLOW))
    return im


def chassis(reach, url):
    """A card with everything on it but its own words.

    The grid, the blue rule, the company in mono caps, the hairline, the
    wordmark and the domain sit at the same measurements on both cards. What
    each one hands in is where its work reaches - the studio names a town
    because the studio has one - and the domain a reader who follows the link
    lands on.
    """
    c = Canvas(W, H)
    c.im.paste(ground().resize((W * SS, H * SS), Image.BICUBIC), (0, 0))
    c.d = ImageDraw.Draw(c.im, "RGBA")

    # The drawing sheet behind everything, from the top left corner so a line
    # falls on the margin's own multiple rather than near it.
    c.grid(GRID, SLAB_INK, 0.065)

    c.rect(MARGIN, 88, 47, 2, fill=BLUE_BRIGHT)
    c.rich(
        151,
        97,
        [("TAYLORURL LLC", BLUE_BRIGHT), (f" · {reach}", SLAB_INK)],
        font(21, "medium", mono=True),
        tracking=0.18,
    )

    # The foot: hairline, wordmark, domain. The mark is the company's and is the
    # one both sites' headers carry, so it is the domain beside it that changes
    # and nothing else.
    c.rect(MARGIN, 502, W - MARGIN * 2 + 1, 1, fill=SLAB_INK)
    c.wordmark(MARGIN, 578, 44, SLAB_INK)
    c.text(
        W - MARGIN,
        577,
        url,
        font(26, "regular", mono=True),
        fill=SLAB_INK,
        tracking=0.03,
        anchor="rs",
    )
    return c


def build(path):
    c = chassis("BAYTOWN, TX", "taylorurl.com")

    # What the studio sells, in two lines, opening on 176 and closing on the
    # baseline at 343.
    head = font(92, "semibold")
    for i, line in enumerate(("Real websites", "for local businesses")):
        c.text(MARGIN, 243 + i * 100, line, head, fill=SLAB_INK, tracking=-0.02)

    # The services and the towns, which is the back half of the alt text
    # `lib/site/registry.js` already gives this image. Nothing on the card is
    # written for the card, so a reader who follows the link lands on the
    # sentence they just read.
    sub = font(28, "regular")
    for i, line in enumerate((
        "Design, build, hosting, and getting found on Google,",
        "for shops and trades around Baytown and Houston.",
    )):
        c.text(MARGIN, 406 + i * 40, line, sub, fill=SLAB_INK)

    return c.save(path)


if __name__ == "__main__":
    print(build(sys.argv[1]))
