# Drawing a mark for this app

The mechanics — sheets, tracing, one command — are in [README.md](README.md).
This is the other half: what makes a drawing work once it is in the app, and what
makes one fail. Everything here was learned by getting it wrong first.

## The 24px rule

This is the only guideline that matters more than the others put together.

A mark is drawn at 370px and rendered at **20 to 24 points**. The nav dock draws
icons at 24, the garden's corner indicators at 20. Nothing in the app draws a
doodle large. So the size a mark is judged at is not the size it is drawn at, and
the mistakes that matter are invisible until you shrink it.

What survives 24px is roughly **three to five strokes around one subject**. What
does not survive is detail. The first `garden` icon was a mushroom, three flowers
and a fallen leaf — a lovely drawing, and an unreadable smudge in the dock. The
replacement is a single sprout with two leaves, four strokes, and it reads.

The practical form of the rule: before you draw, decide the one thing the mark is
of. Then draw only that. `art/preview.html` shows every mark at 96, 48 and 24, and
the 24 column is the one to look at.

Two more consequences worth knowing:

- **Interior detail closes up.** `leaf` came back with six veins. At 20px they
  merge into a grey mass inside the outline. Two or three would have read as veins.
- **A mark reversed on ink loses its thinnest parts first.** The dock draws the
  selected icon in paper on the accent. The preview's "on ink" column is there
  because a stroke that reads on cream can vanish on ink.

## One brush, and it is the widest one

Set the brush to the widest the device offers, match it against the calibration
bar in the sheet's header, and then do not touch it again — not between sheets,
not for the small marks, not for a detail you want finer.

Stroke weight is the only property that cannot be recovered after the fact.
Tracing normalises each mark by its **printed box**, so a mark drawn small stays
small; what it cannot do is change how heavy the stroke is relative to the mark,
because that ratio is what was drawn. Scale a traced outline up and the stroke
scales with it. So a sheet drawn with the wrong brush has to be drawn again.

The box size exists to make this a setting rather than a judgement: at 370px, the
widest brush a Go 10.3 has *is* the nominal weight. If you cannot lay a stroke
that covers the bar, something else is wrong — check that the sheet is filling the
screen and not scaled to fit inside it.

Prefer a **pressure-insensitive brush** (a ballpoint over a fountain pen) so the
width holds along a stroke. A little variation is in the house style; a stroke
that tapers to nothing because you sped up is a stroke that disappears at 24px.

## One subject, and it is already named

Each box on the sheet carries the mark's name and a one-line description of what
it is. Those are not suggestions — they are what the code and the app's copy
already assume. `arrow-right` means onward and appears at the end of a settings
row; `leaf` means one completed sitting and sits beside a count. A drawing that is
lovely and means something else will be wrong in a place you cannot see from the
sheet.

Where there is room to interpret, interpret. Where the name says *sprout*, don't
draw a garden.

## The canvas, and the ground

The box is a 48-unit canvas with a 3-unit margin marked by a dashed inset. Stay
inside it: the margin is what a round nib needs, and a stroke that crosses it
clips when the mark is drawn small.

Plants have one more constraint. Every species is **rooted on the dashed ground
line**, because a plot of 108 shares that baseline — a plant drawn floating will
hover next to its neighbours. Everything else about a plant's placement is free.

Icons have no baseline and are centred; the box's faint crosshair is the middle.

## Draw it, don't construct it

The whole visual language rests on nothing in the app having been made with a
ruler. So:

- **No shape assist, no snapping, no straight-line tool.** If the app has a
  "smooth" or "perfect shape" feature, it is the one feature to leave off.
- **No perfect circles.** A sun's disc, a head, a berry — draw them as
  near-circles that do not quite close the same way twice.
- **Overshoot things.** An arrowhead whose strokes run past the join is what makes
  it look drawn. The code used to fake this with baked-in wobble; a hand does it
  for free.
- **Draw both directions separately.** `arrow-left` is not `arrow-right` flipped.
  A mirrored stroke is the same hand running the wrong way, and the overshoot ends
  up on the side a right hand would not have left it.

Wobble is welcome. Hesitation marks, a doubled line where you went over something
twice, a corner that overshoots — all of it traces fine and all of it is the point.

## Colour is not yours to choose

**Draw in black, always.** Colour is assigned in code, per theme: the same drawing
is ink in Ink and brick in Butter, green as a plant and grey as an empty slot.
A drawing that carried its own colours could not do that, which is why this
pipeline produces path data and not images.

Species that bloom in a second colour — tulip, daisy, thistle, poppy, berry — are
drawn in **two passes**. On the plant sheets you draw only the green parts. Then
`node scripts/drawing-sheets.mjs --blooms` prints a sheet with your own traced
growth on it in grey, and you draw each bloom over its own stem, in register. Same
brush, same rules.

## What not to draw

Three marks in the app are generated and must stay that way, because they stretch
to fit whatever they are next to:

- the wobbly divider (`Rule`)
- the breathing timer ring (`TimerRing`)
- the Meditate button's shape (`box.ts`)

A drawn path stretched to an arbitrary width distorts its own stroke weight — the
long edges thin out — so these are built from geometry that re-wobbles at the
size it is asked for. If one of them needs to change, it is a code change.

## Before you hand a sheet back

- One brush, the widest, unchanged across the whole sheet.
- Black only.
- Nothing crossing the dashed inset.
- Plants rooted on the ground line.
- Every mark is one subject, three to five strokes.
- No shape assist, no straight lines, no perfect circles.
- Nothing drawn in the boxes you were told to leave for a later pass.

Then `npm run art`. It prints the measured pen weight per mark; anything outside
80–125% of nominal means the sheet needs drawing again rather than adjusting.
