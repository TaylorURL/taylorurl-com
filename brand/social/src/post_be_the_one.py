"""The hero line, as a square post.

The site opens on "Be the one they call." and nothing it says is more
recognisable, so the first image in the set is that line at the size it deserves
with the sentence the site already runs underneath it. Nothing here is written
for the image: the copy is lifted off taylorurl.com, so somebody who follows the
link lands on the same words they just read.
"""

import sys

from tulib import INK, Sheet, font, ink

W = H = 1080


def build(path):
    s = Sheet(W, H)
    c, u, m = s.c, s.u, s.m

    head = font(134 * u, "semibold")
    tr = -0.028
    lead = 128 * u
    base = 470 * u

    c.text(m, base, "Be the one", head, tracking=tr)
    c.rich(m, base + lead, [("they ", INK), ("call", s.accent), (".", INK)],
           head, tracking=tr)

    body = font(32 * u, "regular")
    c.paragraph(m, base + lead + 158 * u,
                "I build the websites that get the click, for shops around "
                "Baytown and clients anywhere.",
                body, W - m * 2 - 40 * u, 47 * u, fill=ink(INK, 0.62))

    return s.save(path)


if __name__ == "__main__":
    print(build(sys.argv[1]))
