# Call Mode, five ways

Five mockups of `/console/calls` in its Call Mode view, drawn in the console's
own ink so they can be held against the real screen rather than against a
memory of it.

```
http://localhost:5173/design/call-mode/index.html
```

Vite serves the project root in development and copies only `public/` into a
build, so these render for anybody with the dev server up and reach no
deployment. They are flat HTML with one stylesheet between them and nothing on
them is wired to anything.

## What they are answering

Call Mode today hands a caller a business, a number and eight outcome buttons.
Four things it does not do, and every mockup here has to do all four:

- **A number to aim at.** The page counts what is left, which is four thousand
  today and four thousand tomorrow. A caller cannot have a good morning against
  a figure like that, so none of them ever does.
- **A reason to keep going.** Pace, said as the clock time the shift finishes
  at. Nobody converts calls a minute in their head with a phone against their
  ear.
- **Words to say.** `handbook.js` already composes an opener out of the row on
  screen, and it is reached through a search field in an overlay three columns
  away from the business it was written about.
- **The calls before this one.** `ATTEMPT_HOURS` rings a business at a day,
  three days, a week, a fortnight and a month, so most businesses are rung four
  or five times. All of that reaches the caller as one clause, and who to ask
  for is in a note nobody opens mid-call.

## The five

| File                  | Puts in the middle                                                                |
| :-------------------- | :-------------------------------------------------------------------------------- |
| `1-the-shift.html`    | The shift. Three agreed figures across the top, follow-up above the name.         |
| `2-script-first.html` | The script. One beat at reading size, the rest folded to labels, outcomes pinned. |
| `3-the-record.html`   | The history. Every call as a column, this one as its last entry.                  |
| `4-the-coach.html`    | The answers. A rail that follows the call, and the shift counted by the hour.     |
| `5-one-call.html`     | The business. Name, one sentence, three lines, the keys.                          |

Four and five carry the two shapes a follow-up takes, which are not the same
call: four opens on a time the owner named herself, five on a third try at a
number that has not been picked up.

## Where the content came from

Nothing here is invented. The script lines are what `scriptFor` composes,
the prices are `BUILD_PRICE` and `MONTHLY_PRICE`, the outcomes and their keys
are `CALL_OUTCOMES`, the waits between calls are `ATTEMPT_HOURS`, and the
towns are the ones the portfolio is built in. The business itself is a
stand-in, because a mockup with a real prospect's number on it is a real
prospect's number in a public repository.

`console.css` is a copy of the token block `src/index.css` sets under
`[data-theme='console']`, on purpose: these files have to keep rendering after
the build moves on, and a mockup that quietly restyles itself under a token
change is a mockup nobody can point at.
