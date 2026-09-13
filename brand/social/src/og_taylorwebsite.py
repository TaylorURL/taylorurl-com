"""The share card taylor.website hands to Slack, iMessage, LinkedIn and Facebook.

`public/og.png` is the studio's card and was the only one, so every unfurl of a
taylor.website link showed a locality the second site does not claim, an offer it
does not sell and a domain it is not served from. This draws the other one.

The chassis is not `Sheet`. It is the studio's own card, handed over by
`og_taylorurl.py`: the grid, the margin, the blue rule and mono caps at the top,
the hairline and the wordmark and the domain at the foot, and the glow that
lifts the bottom-right corner off the slab. Two cards read as one company only
if the furniture does not move, and the furniture here is the studio's to the
pixel. What differs is the words and the domain in the corner.

The words are the site's own. The three lines are the home page's headline as
`src/app/data/taylorwebsite/homeTaylorwebsite.js` already sets it, third line in the accent
because that is where the page puts its gradient, and the label is that page's
eyebrow in caps. Nothing on the card is written for the card, which is the same
rule the studio's card is drawn under: a reader who follows the link lands on
the sentence they just read.

    python3 brand/social/src/og_taylorwebsite.py public/og-taylorwebsite.png
"""

import sys

from og_taylorurl import MARGIN, chassis
from tulib import BLUE_BRIGHT, SLAB_INK, font


def build(path):
    c = chassis("COMPANIES ANYWHERE", "taylor.website")

    # The offer, at the size the studio's card gives its own. Three lines of
    # headline rather than two and a subline, because there are three services.
    # The block opens where the studio's opens - first ascender on 176 - and
    # closes within three pixels of where the studio's closes, so the two cards
    # sit at the same weight beside each other.
    head = font(92, "semibold")
    for i, line in enumerate(("Software built.", "Tracking fixed.")):
        c.text(MARGIN, 243 + i * 100, line, head, fill=SLAB_INK, tracking=-0.02)
    c.text(MARGIN, 443, "Outbound run.", head, fill=BLUE_BRIGHT, tracking=-0.02)

    return c.save(path)


if __name__ == "__main__":
    print(build(sys.argv[1]))
