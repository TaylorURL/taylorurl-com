"""Drawing primitives for the TaylorURL social image set.

Every image is composed at twice its delivered size and resampled down on save.
FreeType is built here without Raqm, so Pillow lays glyphs out one at a time with
no kerning and no hinting at small sizes; supersampling is what gets the type
edges back. It also means tracking has to be applied by hand, which `text` does.

Colours and type sizes come from the live site's own custom properties, read off
taylorurl.com rather than restated from memory. The paper ground, the near-black
ink, the single blue accent and the hairline weights are the same values the
site paints with, so an image dropped beside a screenshot of the site reads as
one system.
"""

from PIL import Image, ImageDraw, ImageFont

SS = 2

SRC = __file__.rsplit("/", 1)[0]

PAPER = (246, 246, 245)
INK = (10, 10, 10)
BLUE = (26, 78, 216)
BLUE_BRIGHT = (47, 107, 255)
GREEN = (34, 107, 43)
ORANGE = (148, 74, 8)
NIGHT = (33, 34, 38)
NIGHT_CARD = (42, 43, 47)
NIGHT_INK = (244, 244, 245)
WHITE = (255, 255, 255)

WEIGHTS = {
    "thin": 100, "extralight": 200, "light": 300, "regular": 400,
    "medium": 500, "semibold": 600, "bold": 700, "extrabold": 800, "black": 900,
}

_cache = {}


def font(size, weight="regular", mono=False):
    """A Geist instance at one weight, sized in delivered pixels."""
    key = (round(size * SS), weight, mono)
    if key not in _cache:
        path = f"{SRC}/geist-{'mono-' if mono else ''}variable.ttf"
        f = ImageFont.truetype(path, key[0])
        f.set_variation_by_axes([WEIGHTS[weight]])
        _cache[key] = f
    return _cache[key]


def ink(color, alpha):
    return color + (int(round(alpha * 255)),)


class Canvas:
    """One image, drawn in delivered-pixel coordinates."""

    def __init__(self, w, h, ground=PAPER):
        self.w, self.h = w, h
        self.im = Image.new("RGB", (w * SS, h * SS), ground)
        self.d = ImageDraw.Draw(self.im, "RGBA")

    # Geometry ---------------------------------------------------------------

    def rect(self, x, y, w, h, fill=None, outline=None, width=1, radius=0):
        box = [x * SS, y * SS, (x + w) * SS - 1, (y + h) * SS - 1]
        if radius:
            self.d.rounded_rectangle(box, radius * SS, fill=fill,
                                     outline=outline, width=max(1, round(width * SS)))
        else:
            self.d.rectangle(box, fill=fill, outline=outline,
                             width=max(1, round(width * SS)))

    def line(self, x1, y1, x2, y2, fill, width=1):
        self.d.line([x1 * SS, y1 * SS, x2 * SS, y2 * SS], fill=fill,
                    width=max(1, round(width * SS)))

    def rule(self, x, y, w, color=INK, alpha=0.12, width=1):
        """A hairline. Under a pixel wide it is drawn as alpha, not as nothing."""
        self.d.rectangle([x * SS, y * SS, (x + w) * SS - 1,
                          y * SS + max(1, round(width * SS)) - 1], fill=ink(color, alpha))

    def dot(self, cx, cy, r, fill):
        self.d.ellipse([(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS], fill=fill)

    # Type -------------------------------------------------------------------

    def measure(self, s, f, tracking=0.0):
        """Advance width of a string, including the tracking `text` will apply."""
        if not s:
            return 0.0
        w = sum(f.getlength(c) for c in s) + tracking * f.size * (len(s) - 1)
        return w / SS

    def text(self, x, y, s, f, fill=INK, tracking=0.0, anchor="ls"):
        """Draw a string with tracking, in delivered pixels.

        Glyphs go down one at a time because tracking has to be applied between
        them; nothing is lost by it, since this build has no shaper to apply
        kerning in the first place. `anchor` takes the horizontal half of
        Pillow's anchors (l, m, r) and the vertical half is always a baseline.
        """
        w = self.measure(s, f, tracking) * SS
        px = x * SS
        if anchor[0] == "m":
            px -= w / 2
        elif anchor[0] == "r":
            px -= w
        step = tracking * f.size
        for c in s:
            self.d.text((px, y * SS), c, font=f, fill=fill, anchor="ls")
            px += f.getlength(c) + step
        return w / SS

    def rich(self, x, y, parts, f, tracking=0.0, anchor="ls", default=INK):
        """One line built from (string, colour) runs, tracked as a whole."""
        total = sum(self.measure(s, f, tracking) for s, _ in parts)
        total += tracking * f.size * (len(parts) - 1) / SS
        px = x
        if anchor[0] == "m":
            px -= total / 2
        elif anchor[0] == "r":
            px -= total
        for s, color in parts:
            px += self.text(px, y, s, f, fill=color or default, tracking=tracking)
            px += tracking * f.size / SS
        return total

    def wrap(self, s, f, width, tracking=0.0):
        lines, line = [], ""
        for word in s.split():
            trial = f"{line} {word}".strip()
            if self.measure(trial, f, tracking) <= width or not line:
                line = trial
            else:
                lines.append(line)
                line = word
        if line:
            lines.append(line)
        return lines

    def paragraph(self, x, y, s, f, width, leading, fill=INK, tracking=0.0, anchor="ls"):
        lines = self.wrap(s, f, width, tracking)
        for i, line in enumerate(lines):
            self.text(x, y + i * leading, line, f, fill=fill, tracking=tracking, anchor=anchor)
        return y + (len(lines) - 1) * leading

    # Furniture --------------------------------------------------------------

    def grid(self, step, color=INK, alpha=0.045, origin=(0, 0)):
        """The drawing-sheet grid the site runs behind its sections."""
        x = origin[0]
        while x <= self.w:
            self.rule_v(x, 0, self.h, color, alpha)
            x += step
        y = origin[1]
        while y <= self.h:
            self.rule(0, y, self.w, color, alpha)
            y += step

    def rule_v(self, x, y, h, color=INK, alpha=0.12, width=1):
        self.d.rectangle([x * SS, y * SS, x * SS + max(1, round(width * SS)) - 1,
                          (y + h) * SS - 1], fill=ink(color, alpha))

    def ticks(self, m, length, color=INK, alpha=0.28, width=2):
        """Corner registration marks. A sheet off a job, not a card."""
        w, h = self.w, self.h
        c = ink(color, alpha)
        for (x, y, dx, dy) in ((m, m, 1, 1), (w - m, m, -1, 1),
                               (m, h - m, 1, -1), (w - m, h - m, -1, -1)):
            self.line(x, y, x + dx * length, y, c, width)
            self.line(x, y, x, y + dy * length, c, width)

    def eyebrow(self, x, y, s, size, color=INK, alpha=0.55, bullet=BLUE, tracking=0.16):
        """Square bullet, then mono caps. The site's own section label."""
        f = font(size, "medium", mono=True)
        cx = x
        if bullet:
            side = size * 0.42
            self.rect(cx, y - side, side, side, fill=bullet)
            cx += side + size * 0.62
        self.text(cx, y, s.upper(), f, fill=ink(color, alpha), tracking=tracking)
        return cx

    def wordmark(self, x, y, height, color=BLUE, anchor="l"):
        """The taylorurl mark, cropped to its ink, recoloured, and sat on `y`.

        `y` is the mark's baseline rather than its top, because the wordmark is
        lowercase and its `y` descends: placed by the top it reads as sitting
        lower than any text beside it, which is the one alignment error that
        shows on every image in the set at once. `height` is the full crop,
        descender included.
        """
        mark, base = _wordmark(color)
        w = round(height * mark.width / mark.height)
        px = round(x * SS)
        if anchor == "m":
            px -= round(w * SS / 2)
        elif anchor == "r":
            px -= round(w * SS)
        img = mark.resize((round(w * SS), round(height * SS)), Image.LANCZOS)
        self.im.paste(img, (px, round((y - height * base) * SS)), img)
        return w

    def save(self, path):
        out = self.im.resize((self.w, self.h), Image.LANCZOS)
        out.save(path, "PNG", optimize=True)
        return path


class Sheet:
    """The chassis every image in the set is drawn on.

    A library only reads as one library if the furniture does not move, so the
    grid, the registration marks, the header label and the footer rail are drawn
    here once and the templates are handed the box that is left. Every measure
    is a multiple of `u`, taken off the short side, which is what lets a story at
    9:16 and a post at 1:1 keep the same margins rather than the same numbers.
    """

    def __init__(self, w, h, dark=False, label="TaylorURL LLC · Baytown, TX",
                 url="taylorurl.com", accent=None, grid=True):
        self.u = u = min(w, h) / 1080
        self.dark = dark
        self.ground = NIGHT if dark else PAPER
        self.ink = NIGHT_INK if dark else INK
        self.accent = accent or (BLUE_BRIGHT if dark else BLUE)
        self.c = c = Canvas(w, h, self.ground)
        self.w, self.h = w, h
        self.m = m = round(96 * u)

        if grid:
            c.grid(round(60 * u), self.ink, 0.09 if dark else 0.045)
        c.ticks(round(56 * u), round(26 * u), self.ink, 0.34 if dark else 0.28, 2 * u)

        c.eyebrow(m, round(170 * u), label, 21 * u, self.ink,
                  0.62 if dark else 0.55, self.accent)
        c.rule(m, round(206 * u), w - m * 2, self.ink, 0.16 if dark else 0.13)

        c.rule(m, h - round(180 * u), w - m * 2, self.ink, 0.16 if dark else 0.13)
        c.wordmark(m, h - round(110 * u), round(40 * u), self.accent)
        c.text(w - m, h - round(110 * u), url, font(23 * u, "regular", mono=True),
               fill=ink(self.ink, 0.52), tracking=0.03, anchor="rs")

        self.top = round(206 * u)
        self.bottom = h - round(180 * u)

    @property
    def mid(self):
        return (self.top + self.bottom) / 2

    def save(self, path):
        return self.c.save(path)


_mark_cache = {}


def _wordmark(color):
    """The logo file, cropped to its ink and flooded with one colour.

    The published PNG carries a green halo from whatever produced it and sits in
    a square with most of the height empty, so neither the crop nor the recolour
    is cosmetic: pasted as shipped it brings a coloured fringe and a margin no
    layout asked for. Alpha is kept and the RGB thrown away, which also lets the
    same file sit on a dark ground.

    Read from `public/` rather than from beside the fonts, because that is the
    only copy of the mark in the tree and a second one here would be a file that
    goes stale the first time the logo is redrawn.
    """
    if color in _mark_cache:
        return _mark_cache[color]
    im = Image.open(f"{SRC}/../../../public/images/TaylorURL-Logo.png").convert("RGBA")
    alpha = im.getchannel("A").point(lambda v: 0 if v < 90 else 255)
    im.putalpha(alpha)
    im = im.crop(alpha.getbbox())
    flat = Image.new("RGBA", im.size, color + (255,))
    flat.putalpha(im.getchannel("A"))

    # Where the baseline falls in the crop, found rather than assumed: reading
    # up from the bottom, the first row carrying more than the descender alone.
    rows = [sum(1 for x in range(flat.width) if flat.getpixel((x, y))[3] > 0)
            for y in range(flat.height)]
    floor = rows[-1] * 3
    base = next((y for y in range(flat.height - 1, 0, -1) if rows[y] > floor),
                flat.height - 1) / flat.height

    _mark_cache[color] = (flat, base)
    return _mark_cache[color]
