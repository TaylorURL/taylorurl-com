"""The post cards `public/social/` serves, rebuilt from their words.

Buffer fetches these when a post falls due, so what a card says is published to
Instagram three times a week whether or not anybody reread it lately. They had
been shipped as PNGs with no generator behind them, which is why nine of them
went on saying "I build" and "one person, start to finish" for a year after that
stopped being true: the words were only in the pixels, and nothing in the tree
could be edited to change them.

This builds the ones whose copy the studio actually writes. The layouts are the
shipped ones, measured off the cards themselves rather than reinvented, so a
rebuild lands on the same grid, the same type sizes and the same baselines the
set has always used and a card regenerated here sits beside one that was not.
The three cards it leaves alone - `say-phone-first`, `say-picked-up` and
`say-vetted` - say nothing about who does the work, and one of them carries the
BBB seal as artwork rather than as type.

    python3 brand/social/src/cards.py public/social

Every card is 1080 x 1350, which is the tallest frame Instagram gives anything
in the feed, and `check:social-assets` holds the folder to it.
"""

import sys

from PIL import Image

from tulib import BLUE, INK, Sheet, font, ink

W, H = 1080, 1350

# The measure every body paragraph wraps inside: the text column, less the
# forty pixels that keep a line of body type from running the full width of a
# headline set above it.
WRAP = W - 96 * 2 - 40


def say(path, label, lines, head_size, base, lead, body, body_base, body_lead=52):
    """One card of the say set: a label, a headline, and a paragraph under it.

    `lines` are the headline's lines, each a list of `(text, colour)` runs, so
    the one word a card sets in blue is named where it is read rather than
    reconstructed from an index.
    """
    sheet = Sheet(W, H, label=label)
    c, m = sheet.c, sheet.m

    head = font(head_size, "semibold")
    for index, parts in enumerate(lines):
        c.rich(m, base + index * lead, parts, head, tracking=-0.028)

    c.paragraph(m, body_base, body, font(36, "regular"), WRAP, body_lead, fill=ink(INK, 0.62))
    return sheet.save(path)


def be_the_one(path):
    return say(
        path,
        "TaylorURL LLC · Baytown, TX",
        [[("Be the one", None)], [("they ", None), ("call", BLUE), (".", None)]],
        head_size=168,
        base=556,
        lead=161,
        body="We build the websites that get the click, for shops around Baytown "
        "and clients anywhere.",
        body_base=830,
    )


def check_yourself(path):
    return say(
        path,
        "SCORES YOU CAN CHECK YOURSELF",
        [
            [("Google grades", None)],
            [("every site, and", None)],
            [("the report is ", None), ("free", BLUE), (".", None)],
        ],
        head_size=108,
        base=502,
        lead=103.5,
        body="Four things, graded on every site there is. Run it on any site we have "
        "built and read the result yourself.",
        body_base=790,
    )


def watched(path):
    return say(
        path,
        "WATCHED AFTER LAUNCH",
        [
            [("When something", None)],
            [("breaks, we know", None)],
            [("before ", BLUE), ("you call.", None)],
        ],
        head_size=112,
        base=523,
        lead=107,
        body="Every site we look after reports its uptime and its errors to a page "
        "anyone can open.",
        body_base=821,
    )


def one_person(path):
    # The file keeps its name because the name is what `utm_campaign` carries,
    # and renaming it would split this card's reading in `analytics_events` at
    # the day of the rename. The label is the half that was actually wrong.
    return say(
        path,
        "THE PEOPLE BUILDING IT",
        [
            [("You talk to", None)],
            [("whoever", BLUE), (" is", None)],
            [("building it.", None)],
        ],
        head_size=168,
        base=486,
        lead=161,
        body="No account manager in between, and the same number after launch as before it.",
        body_base=920,
    )


def get_started(path):
    return say(
        path,
        "LET'S TALK",
        [
            [("Ready to", None)],
            [("get", None)],
            [("started", BLUE), ("?", None)],
        ],
        head_size=168,
        base=463,
        lead=161,
        body="Tell us about the business and what you need. Reply within 24 hours, "
        "no sales pitch, honest answers.",
        body_base=897,
    )


def stay_focused(path):
    return say(
        path,
        "GO LIVE",
        [
            [("We keep it", None)],
            [("online, fast,", BLUE)],
            [("and safe", BLUE), (".", None)],
        ],
        head_size=165,
        base=511,
        lead=157.5,
        body="So you can stay focused on running the business.",
        body_base=936,
    )


# Where the text column of the two list cards starts, clear of the bullet or
# the step number sitting in the margin beside it.
LIST_X = 128
STEP_X = 192


def included(path):
    """What every site gets, as four things with a line between each."""
    sheet = Sheet(W, H, label="EVERY SITE WE BUILD")
    c, m = sheet.c, sheet.m
    title = font(47, "bold")
    body = font(28, "regular")

    rows = [
        (
            "Built for the phone first",
            "The screen most people find you on, designed for before the desktop is.",
        ),
        (
            "A score you can check yourself",
            "Google grades every site on four things and publishes the report free.",
        ),
        ("Watched after launch", "Uptime and errors reported to a page anyone can open."),
        ("The people building it", "The same number after launch as before it."),
    ]

    y = 325
    for head, text in rows:
        c.rule(m, y, W - m * 2, INK, 0.13)
        c.rect(m, y + 26, 10, 10, fill=BLUE)
        c.text(LIST_X, y + 51, head, title, tracking=-0.03)
        lines = c.wrap(text, body, W - LIST_X - m)
        for index, line in enumerate(lines):
            c.text(LIST_X, y + 98 + index * 40, line, body, fill=ink(INK, 0.7))
        y += 97.5 + (len(lines) - 1) * 40 + 70

    return sheet.save(path)


def process(path):
    """The three steps, numbered, with a line above each."""
    sheet = Sheet(W, H, label="HOW IT WORKS")
    c, m = sheet.c, sheet.m
    number = font(36, "medium", mono=True)
    title = font(60, "bold")
    body = font(29, "regular")

    steps = [
        (
            "Get in Touch",
            "Call, text, or email. Tell us what your business does and what you need. "
            "You get a straight answer, not a sales pitch.",
        ),
        (
            "We Build It",
            "We get to work and show you progress as we go. You can give feedback any "
            "time. No drawn-out timelines and no surprises at the end.",
        ),
        (
            "Go Live",
            "Your site goes live. We keep it online, fast, and safe so you can stay "
            "focused on running the business.",
        ),
    ]

    y = 327
    for index, (head, text) in enumerate(steps):
        c.rule(m, y, W - m * 2, INK, 0.13)
        c.text(m, y + 45, f"0{index + 1}", number, fill=BLUE, tracking=0.03)
        c.text(STEP_X, y + 45, head, title, tracking=-0.03)
        lines = c.wrap(text, body, W - STEP_X - m - 8)
        for line_index, line in enumerate(lines):
            c.text(STEP_X, y + 100 + line_index * 42, line, body, fill=ink(INK, 0.7))
        y += 100 + (len(lines) - 1) * 42 + 83.5

    return sheet.save(path)


# Below this row a card is its own artwork rather than the chassis, which is
# what `relabel` keeps and what it may not redraw.
HEADER_ROWS = 210


def relabel(path, source, label):
    """A shipped card with its header label redrawn, and nothing else touched.

    For a card whose only wrong word is the one in its label. The chassis - the
    grid, the registration marks, the header rule, the footer and the wordmark -
    is drawn from the same measurements the shipped card was drawn from and
    lands on it pixel for pixel, so a new label can be set on a fresh sheet and
    the card's own artwork laid back over it. Rebuilding twenty-two rows of
    trades from scratch to change one word would be a larger change than the
    word is.
    """
    sheet = Sheet(W, H, label=label)
    fresh = sheet.c.im.resize((W, H), Image.LANCZOS).convert("RGB")
    shipped = Image.open(source).convert("RGB")
    fresh.paste(shipped.crop((0, HEADER_ROWS, W, H)), (0, HEADER_ROWS))
    fresh.save(path, "PNG", optimize=True)
    return path


def trades(path):
    return relabel(path, path, "TRADES WE BUILD FOR")


CARDS = {
    "say-be-the-one": be_the_one,
    "say-check-yourself": check_yourself,
    "say-watched": watched,
    "say-one-person": one_person,
    "say-get-started": get_started,
    "say-stay-focused": stay_focused,
    "included": included,
    "process": process,
    "trades": trades,
}


def main(folder):
    for name, build in CARDS.items():
        print(build(f"{folder}/{name}.png"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "public/social")
