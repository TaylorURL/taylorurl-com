# The staff system, five ways

Five mockups of `taylorurl.com/staff` and the three surfaces behind it, drawn on
the site's own tokens.

**The direction below is built.** `/staff` is a real route now: gated on an
account, wired to the same call list the console's own calling screen reads, and
it lives under `src/app/views/staff/`. These drawings are kept as the argument
the build came out of, not as the thing that ships. Where one of them disagrees
with the route, the route is right.

```
http://localhost:5173/design/staff-portal/index.html
```

Vite serves the project root in development and copies only `public/` into a
build, so these render for anybody with the dev server up and reach no
deployment. They are flat HTML and nothing on them is wired to anything.

## The direction

`thumb-applied.html` is the one that was picked, drawn at both sizes it has to
work at with the two beside each other so they cannot quietly become two
designs. A head that is only read, one scrolling column, and a foot that never
moves. The desktop is the same three parts with the column held at a reading
measure and the bars run full width; everything the two sizes disagree about is
one custom property in `thumb.css`.

It carries all four surfaces plus the screen a list runs out on, and its call
screen runs: the tags select, Needs Time opens its lengths, the mark reveals the
two questions, Next unlocks once both are answered, and Back and Next move
between two businesses - a third call to one that has a record, and a first call
to one that has neither a record nor a website. Nothing is stored and nothing is
sent. The questions left on this direction are about sequence rather than
arrangement, and none of them can be read off a picture.

A Needs Time answer with no length picked is not refused. `calls.js` settled the
same question once for a call back nobody timed, and a screen that refuses here
gets a made-up length typed into it.

## Five systems, not five screens

Each file draws all four surfaces, because the decisions worth arguing about are
the ones between them rather than inside any one of them:

- Is this one application or four that share a login?
- Where does the handbook live when somebody is on the line?
- Can anybody see anybody else?

| File                | Decides                                                                  |
| :------------------ | :----------------------------------------------------------------------- |
| `1-full-bleed.html` | Four products, no shared chrome. Each screen is the whole window.        |
| `2-the-shell.html`  | One application, a rail that never leaves, a panel per room.             |
| `3-key-first.html`  | Nothing needs a mouse. Dense and dark, every control on a key.           |
| `4-thumb.html`      | A phone beside the handset. One column, a fixed bar at the foot. Picked. |
| `5-the-floor.html`  | Everybody sees everybody. A strip of the floor on every screen.          |

## The four surfaces

**Portal** is the gate and the way to the other three: Main Site, Call Center,
Management Center, Resources Center.

**Call Center** is the only surface staff drive. One business at a time - the
number, who they are, every call before this one, the words to say, back to the
last business, mark this one called, and next once it is marked.

**Management Center** is who is on the phones, how far through their list, what
came back today, and the two things only a manager can do: move a list, and read
the refusals.

**Resources Center** is the script, the prices, the answers to pushback and the
written procedures.

## Two questions at the end of a call

**What the call came to** is about the call: no answer, voicemail, gatekeeper,
spoke to owner, booked, wrong number.

**What the business is** is about next year: Yes, Maybe, Needs Time, Price Issue,
No. A phone that rang out is not a business that said no, so one field cannot
carry both. Needs Time is the only tag that opens anything, and it offers four
lengths rather than a date, because the only thing ever read off it is which
month to put the business back in.

## Where the content came from

The prices are `BUILD_PRICE` and `MONTHLY_PRICE`. The business on every call
screen is a stand-in on a 555-01xx number, because a mockup with a real
prospect's number on it is a real prospect's number in a public repository.

`staff.css` is a copy of the token block `src/index.css` sets, on purpose: these
files have to keep rendering after the build moves on, and a mockup that quietly
restyles itself under a token change is a mockup nobody can point at. Layout
stays in each file, because layout is the thing being proposed.
