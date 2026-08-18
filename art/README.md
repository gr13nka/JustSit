# Drawing the app's art by hand

The plants and icons in this app are currently pen paths written by hand *in
code*. This folder is the jig for replacing them with pen paths drawn by hand
*on paper* — or, here, on a Boox.

## Why this can't just be images

Every mark in `src/ui/` takes its colour from the live theme at render time
(`stroke={color}`), which is what lets one drawing be ink in Ink, brick in
Butter, green as a plant and grey as an empty slot. A PNG carries the colours it
was drawn in and cannot be repainted, so a scanned drawing has to come back as
**SVG path data**, not as an image. That is the one non-obvious step in the
pipeline, and it is automated: you draw, and a trace script turns strokes into
paths.

The upside is that the drawings then stay drawings — they scale, they weigh
nothing, and they keep working when a fourth theme shows up.

## What you're drawing

Two sheets, eighteen marks, nine to a page, all on the same 48-unit canvas and
therefore all in the same pen:

| Sheet | Marks |
|---|---|
| 1 | the six icons, then grass · sprout · clover |
| 2 | fern · tulip · daisy · mushroom · thistle · poppy · reed · berry · sapling |

**Use the widest brush the device has, and don't change it.** That is the whole
instruction, and the box is sized so that it is also the right answer: a Go 10.3's
pen stops at 2.0mm, so the 370px box makes 2.0mm *be* the nominal 2.8-unit nib.
The calibration bar in the header is that width — you should be able to lay a
stroke straight over it. If you can't, something else is set wrong.

The first sheets used a 480px box and asked for a stroke no brush on the device
could produce; two passes came in at 34% and 77% of nominal and the second was as
heavy as the hardware allows. Every sheet must keep the same box for the same
reason: marks drawn in different-sized boxes carry different stroke weights into
the same app, and that is invisible until they sit side by side.

Five species bloom in a second colour (tulip, daisy, thistle, poppy, berry).
Those get a **fourth sheet later** — see *the bloom pass* at the bottom. On
sheets 2 and 3 you draw only their green parts.

## 1 · Get the sheet onto the Boox

`art/templates/` holds the same three sheets twice:

- `justsit-sheets.pdf` — all three pages
- `justsit-sheets-1-icons.png` and friends — one page each, at exactly
  1404 × 1872, which is the Go 10.3's panel. Full-screen, one device pixel per
  template pixel, nothing resampled.

Copy them across with **BooxDrop** (Settings → BooxDrop gives you a LAN address;
open it in a browser here and drag the files over). No cable, no Android File
Transfer.

Then, in **Notes**, make a new note and set the sheet as its *template* or
*background* — the PNG is the safer of the two for that, the PDF if your
firmware takes one. What matters is that the guides sit *under* your ink and
that the page fills the screen.

## 2 · Drawing rules

The craft — what makes a mark work once it is in the app, and what makes one fail
— is in **[DRAWING.md](DRAWING.md)**. Read it once before the first sheet; it is
short and every rule in it was learned by getting something wrong.

The three that cannot be fixed after the fact, in case you read nothing else:

- **The widest brush the device has, unchanged across the whole sheet.** Stroke
  weight is the one property tracing cannot recover, so a sheet drawn with the
  wrong brush has to be drawn again.
- **Black only.** Colour is assigned in code, per theme.
- **Three to five strokes around one subject.** A mark is drawn at 370px and
  rendered at 24.


## 3 · Hand it back, and apply it

Export from Notes as **PNG** (per page, full resolution — not "share as image",
which sometimes downscales). Save it anywhere in `~/Downloads` or `~/Desktop`;
Telegram to yourself is fine, and was measured to survive the round trip intact.
Then:

```sh
npm run art
```

That is the whole loop. It finds the newest image that is actually a drawing
sheet, works out **which** sheet it is, keeps it as the next version under
`art/scans/`, traces it, wires the paths into the app, and opens a preview.
Nothing is overwritten and nothing has to be named.

If you want to be explicit:

```sh
npm run art -- ~/Downloads/whatever.jpg          # this file, sheet auto-detected
npm run art -- art/scans/icons-v2.jpg icons      # ...and this sheet, no detection
npm run art -- --no-open                         # don't open the preview
```

The transport can resample freely — the four corner marks recover the scale and
offset, and a sheet that came back through Telegram at 960×1280 still solved to
a 0.0004 skew. What it must not do is **crop, rotate, or cut off a corner mark**.

The one number to read afterwards is the pen weight the run prints:

```
sheet pen 2.71 units (97% of nominal), spread 1.08x across the sheet
```

Anything outside 80–125% means the brush missed the calibration bar, and the fix
is to re-draw, not to rescale — scaling a traced outline changes how big the mark
is, not how heavy its stroke is. On the retired 480px sheets this read **34%** and
then **77%**, and 77% was the ceiling: no brush on the device could reach that
bar. On the 370px sheets the widest brush should land near 100%.

## 4 · What happens inside `npm run art`

1. Corner marks give the page transform, so each drawing box is cropped at a
   known place.
2. A morphological opening removes anything thinner than about a third of a nib
   — which is every guide line on the sheet, whether or not the export
   thresholded them away first.
3. `potrace` turns each mark into outline paths.
4. The paths are mapped onto the 48-unit canvas by the *box*, not by their own
   bounding box, which is what keeps the pen consistent between marks.
5. Out comes generated path data in `src/ui/icons.paths.ts`, drawn by the
   hand-written components in `src/ui/icons.tsx` with the tinting they already had.

Each step also runs alone, which is how you debug one:

```sh
node scripts/drawing-sheets.mjs                       # print the sheets
node scripts/drawing-sheets.mjs --blooms              # ...and the bloom overlay sheet
uv run scripts/trace-art.py <scan> --detect           # which sheet is this?
uv run scripts/trace-art.py <scan> [sheet]            # scan  -> art/traced/*.json
uv run scripts/trace-art.py <scan> --manifest <path>  # ...against a retired geometry
node scripts/art-to-code.mjs                          # json  -> src/ui/icons.paths.ts
node scripts/art-preview.mjs [sheet]                  # json  -> art/preview.html
```

Codegen collects marks by **name** across every traced sheet, not per sheet, so
repaginating the sheets never needs a code change. It refuses to write a module
with a hole in it, and warns when the icons turn out to come from more than one
sheet — an undrawn box contributes nothing rather than an empty mark, so a partial
re-draw otherwise leaves the rest standing at whatever weight traced them last.

`art/templates/gen-480/` holds the retired 480px sheets. The manifest is a
parameter rather than a constant precisely so those two scans stay re-traceable:

```sh
uv run scripts/trace-art.py art/scans/icons-v2.jpg \
  --manifest art/templates/gen-480/justsit-sheets.manifest.json
```

reproduces `art/traced/icons.json` exactly. Template images resolve beside their
own manifest, so an archived generation carries everything it needs.

Traced outlines are filled shapes rather than stroked centrelines, so the marks
become `fill` where they were `stroke`. That keeps the real nib — the pressure,
the taper, the way a stroke ends — instead of throwing it away and re-stroking
at a uniform 2.8. `src/ui/pen.ts` gets a sibling for the new contract.

## 5 · The bloom pass

Once sheets 2 and 3 are traced, run:

```sh
node scripts/drawing-sheets.mjs --blooms
```

That prints a fourth sheet with **your own traced growth already on it, in
grey** — so you draw each bloom directly over the stem you drew, in register, and
the two layers can still be tinted separately. Same brush, same rules.
