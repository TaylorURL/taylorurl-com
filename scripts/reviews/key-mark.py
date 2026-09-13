#!/usr/bin/env python3
"""
Takes the flat ground off a reviewer's mark, in place.

A site's icon is drawn for a browser tab and a phone screen, and most of them
carry the ground those need: a white square, a black one, the brand's own
colour edge to edge. On the review card the mark stands on the page's paper
with nothing behind it, so that square is the one thing on the card that reads
as pasted on. The ground is found by reading the mark's own border, which is
where a flat ground shows and a drawing does not, and is cleared inward from
there: every pixel joined to the border and within the tolerance of the
border's colour is made transparent, and the drawing is left standing.

A mark whose border is not one colour is left alone. That is a photograph, a
gradient or a drawing run to its own edge, and clearing the wrong pixels of it
would cost more than the square.

capture-review-logos.js runs this over every mark it captures. By hand:

    python3 scripts/reviews/key-mark.py public/images/reviews/<mark>.png

It needs Pillow, the same as the artwork under brand/.
"""
import sys
from collections import Counter, deque

from PIL import Image

# How far a pixel may sit from the ground colour, per channel, and still be
# ground. Icons are compressed and resampled on the way here, so a flat white
# arrives as a spread of near-whites.
TOLERANCE = 12

# Past the ground itself, the band of colours a resampler blends between the
# ground and the drawing. Those pixels are neither, so they keep the drawing's
# share and lose the ground's; keyed with a hard edge instead, a mark wears a
# fringe the colour of the square it just lost.
SOFT = 64

# The share of the border that has to be the ground colour before the border
# is read as one. A mark drawn to its own edge fails this and is left as it is.
FLAT = 0.9


def distance(pixel, ground):
    return max(abs(pixel[channel] - ground[channel]) for channel in range(3))


def key(path):
    image = Image.open(path).convert('RGBA')
    width, height = image.size
    pixels = image.load()
    border = [(x, y) for x in range(width) for y in (0, height - 1)]
    border += [(x, y) for y in range(height) for x in (0, width - 1)]
    opaque = [pixels[x, y] for x, y in border if pixels[x, y][3] > 0]
    if not opaque:
        return f'left {path}: its ground is already clear'
    ground = Counter(pixel[:3] for pixel in opaque).most_common(1)[0][0]
    flat = sum(1 for pixel in opaque if distance(pixel, ground) <= TOLERANCE) / len(border)
    if flat < FLAT:
        return f'left {path}: its border is not one colour'

    seen = bytearray(width * height)
    queue = deque(border)
    cleared = 0
    while queue:
        x, y = queue.popleft()
        if not (0 <= x < width and 0 <= y < height):
            continue
        at = y * width + x
        if seen[at]:
            continue
        seen[at] = 1
        pixel = pixels[x, y]
        if pixel[3] > 0:
            apart = distance(pixel, ground)
            if apart > TOLERANCE:
                if apart < SOFT:
                    share = (apart - TOLERANCE) / (SOFT - TOLERANCE)
                    pixels[x, y] = (pixel[0], pixel[1], pixel[2], round(pixel[3] * share))
                continue
            pixels[x, y] = (pixel[0], pixel[1], pixel[2], 0)
            cleared += 1
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    image.save(path, optimize=True)
    return f'keyed {path}: {cleared} pixels of {ground} cleared'


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage: key-mark.py <png>')
    print(key(sys.argv[1]))
