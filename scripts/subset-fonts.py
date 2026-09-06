#!/usr/bin/env python3
"""Cut the two Geist faces down to the characters the site can actually set.

Geist ships as a full multi-script variable build: Latin, Cyrillic, Vietnamese,
box drawing, dingbats, and every stylistic set the typeface was drawn with. That
is a hundred and forty kilobytes across the two files, and both of them sit on
the critical path - the document names them so they are fetched beside the
stylesheet, and the largest element on a phone is a line set in the mono face.
Every kilobyte in there is a kilobyte the first paint waits on, and the site
sets none of the scripts that make up most of them.

So the files under public/fonts are subsets, and this is what makes them. Run it
against a freshly downloaded upstream build; commit the result.

    python3 scripts/subset-fonts.py <upstream-dir>
    python3 scripts/subset-fonts.py <upstream-dir> --check

What is kept, and why each part of it is kept:

  Basic Latin, Latin-1 Supplement and Latin Extended-A cover the copy in the
  repository and the names that arrive from the database at runtime. Client and
  town names are not in the source tree, so the accented ranges are carried
  whole rather than character by character - a surname is exactly the place a
  missing glyph would surface, and exactly the place nobody would think to look.

  Combining Diacritical Marks are carried so decomposed text sets correctly.
  Precomposed text is the norm on the web, but text that has been through a
  macOS filesystem is not, and a floating accent is as visible as a tofu.

  General Punctuation carries the dashes, the curly quotes, the ellipsis and
  the middle dot the copy is written with, plus the invisible spaces that
  formatted dates and figures put between a number and its unit.

  The layout features are the ones a browser can reach: the always-on set, the
  kerning, the two stylistic sets the stylesheet turns on, the tabular figures
  the tables and counters are set in, and the numeric and positional features
  that ordinary `font-variant-numeric` can ask for. The nine stylistic sets
  nothing declares are dropped, along with `aalt`, which no browser applies -
  between them they were carrying about a third of the mono file.

  fvar, gvar, HVAR, MVAR and STAT stay intact. These are variable fonts and the
  site sets six weights off a single file per family; flattening them to a
  static instance would trade the saving here for five more requests.

scripts/check-font-coverage.js holds the result to all of that on every run of
the test suite, so a re-subset that quietly drops a range fails there rather
than in front of a reader.
"""

import argparse
import pathlib
import subprocess
import sys
import tempfile

FACES = ('geist-variable.woff2', 'geist-mono-variable.woff2')

UNICODES = (
    'U+0020-007E',  # Basic Latin
    'U+00A0-00FF',  # Latin-1 Supplement
    'U+0100-017F',  # Latin Extended-A
    'U+02B0-02FF',  # Spacing Modifier Letters
    'U+0300-036F',  # Combining Diacritical Marks
    'U+2000-206F',  # General Punctuation
    'U+2070-209F',  # Superscripts and Subscripts
    'U+20A0-20BF',  # Currency Symbols
    'U+2122',  # Trade mark sign
    'U+2190-21FF',  # Arrows
    'U+2212',  # Minus sign
    'U+2260',  # Not equal to
    'U+2264-2265',  # Less/greater than or equal to
    'U+25CA',  # Lozenge
    'U+FB00-FB04',  # Latin ligatures
)

FEATURES = (
    'ccmp', 'locl', 'liga', 'clig', 'calt', 'rlig', 'kern', 'mark', 'mkmk',
    'ss01', 'ss02', 'tnum', 'pnum', 'case', 'frac', 'numr', 'dnom', 'sups',
    'subs', 'sinf', 'ordn', 'dlig',
)


def subset(source: pathlib.Path, target: pathlib.Path) -> None:
    subprocess.run(
        [
            'pyftsubset',
            str(source),
            f'--output-file={target}',
            '--flavor=woff2',
            f'--unicodes={",".join(UNICODES)}',
            f'--layout-features={",".join(FEATURES)}',
        ],
        check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('upstream', type=pathlib.Path,
                        help='directory holding the full upstream woff2 files')
    parser.add_argument('--check', action='store_true',
                        help='report what would change, write nothing')
    args = parser.parse_args()

    fonts = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'fonts'
    missing = [f for f in FACES if not (args.upstream / f).is_file()]
    if missing:
        print(f'not in {args.upstream}: {", ".join(missing)}', file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory() as scratch:
        for face in FACES:
            source = args.upstream / face
            built = pathlib.Path(scratch) / face
            subset(source, built)
            before, after = source.stat().st_size, built.stat().st_size
            cut = 100 * (before - after) / before
            print(f'{face:<28} {before:>7} -> {after:>7} bytes  ({cut:.1f}% off)')
            if not args.check:
                (fonts / face).write_bytes(built.read_bytes())

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
