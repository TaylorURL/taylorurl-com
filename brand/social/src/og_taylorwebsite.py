"""The share card taylor.website hands to Slack, iMessage, LinkedIn and Facebook.

`public/og.png` is the studio's card and was the only one, so every unfurl of a
taylor.website link showed a locality the second site does not claim, an offer it
does not sell and a domain it is not served from. This draws the other one.

The chassis is not `Sheet`. The studio's card predates this directory and
whatever produced it is not in the tree, so the geometry below is measured off
`public/og.png` itself: the 96-pixel grid, the 84-pixel margin, the blue rule and
mono caps at the top, the hairline and the wordmark and the domain at the foot,
and the glow that lifts the bottom-right corner off black. Two cards read as one
company only if the furniture does not move, and the furniture here is the
studio's to the pixel. What differs is the words and the domain in the corner.

The words are the site's own. The three lines are the home page's headline as
`src/app/data/taylorwebsite/homeTaylorwebsite.js` already sets it, third line in the accent
because that is where the page puts its gradient, and the label is that page's
eyebrow in caps. Nothing on the card is written for the card, which is the same
rule the studio's card was drawn under: a reader who follows the link lands on
the sentence they just read.

    python3 brand/social/src/og_taylorwebsite.py public/og-taylorwebsite.png
"""

import sys

from PIL import Image, ImageDraw

from tulib import BLUE_BRIGHT, SS, WHITE, Canvas, font

W, H = 1200, 630

# The margin every element is set from, and the rule the grid runs on. Both are
# read off the studio's card rather than chosen: the hairline above the footer
# runs from 84 to 1116, and the grid lines fall on multiples of 96 from the top
# left corner.
MARGIN = 84
GRID = 96

# The corner glow. A flat ground would be a different card, and the studio's is
# black everywhere except the bottom right, where it lifts to a deep blue. The
# falloff is a smootherstep over an ellipse anchored on that corner, fitted to
# the published card at a root-mean-square error of about three levels out of the
# sixty-four the blue channel travels, which is under what a screen resolves.
GLOW = (12, 27, 64)
GLOW_RX, GLOW_RY = 1000, 650


def ground():
    """The black sheet and its corner glow, at delivered size."""
    im = Image.new("RGB", (W, H))
    px = im.load()
    for y in range(H):
        dy = ((H - 1 - y) / GLOW_RY) ** 2
        for x in range(W):
            dx = ((W - 1 - x) / GLOW_RX) ** 2
            u = 1 - (dx + dy) ** 0.5
            if u <= 0:
                continue
            t = u * u * u * (u * (u * 6 - 15) + 10)
            px[x, y] = tuple(round(c * t) for c in GLOW)
    return im


def build(path):
    c = Canvas(W, H)
    c.im.paste(ground().resize((W * SS, H * SS), Image.BICUBIC), (0, 0))
    c.d = ImageDraw.Draw(c.im, "RGBA")

    # The drawing sheet behind everything, from the top left corner so a line
    # falls on the margin's own multiple rather than near it.
    c.grid(GRID, WHITE, 0.065)

    # The label: a blue rule, the company, and where the work reaches. The studio
    # names its town here because the studio has one. This site's half of that
    # line is the reach, which is the thing it has instead.
    c.rect(MARGIN, 88, 47, 2, fill=BLUE_BRIGHT)
    c.rich(
        151,
        97,
        [("TAYLORURL LLC", BLUE_BRIGHT), (" · COMPANIES ANYWHERE", WHITE)],
        font(21, "medium", mono=True),
        tracking=0.18,
    )

    # The offer, at the size the studio's card gives its own. Three lines rather
    # than two because there are three services, and the block still opens and
    # closes where the studio's does - first ascender on 176, last baseline on
    # 443 - so the two cards sit at the same weight beside each other.
    head = font(92, "semibold")
    for i, line in enumerate(("Software built.", "Tracking fixed.")):
        c.text(MARGIN, 243 + i * 100, line, head, fill=WHITE, tracking=-0.02)
    c.text(MARGIN, 443, "Outbound run.", head, fill=BLUE_BRIGHT, tracking=-0.02)

    # The foot: hairline, wordmark, domain. The mark is the company's and is the
    # one the site's own header carries, so it is the domain beside it that
    # changes and nothing else.
    c.rect(MARGIN, 502, W - MARGIN * 2 + 1, 1, fill=WHITE)
    c.wordmark(MARGIN, 578, 44, WHITE)
    c.text(
        W - MARGIN,
        577,
        "taylor.website",
        font(26, "regular", mono=True),
        fill=WHITE,
        tracking=0.03,
        anchor="rs",
    )

    return c.save(path)


if __name__ == "__main__":
    print(build(sys.argv[1]))
