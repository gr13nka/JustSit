# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Expo HAS CHANGED

Read the exact versioned docs at <https://docs.expo.dev/versions/v57.0.0/> before
writing any code. This project is on **SDK 57 / React 19.2 / React Native 0.86**,
and APIs you may remember from older SDKs (`expo-av`, the old notification
trigger shapes, `AppLoading`) are gone or renamed. Do not write Expo code from
memory.

## What this is

JustSit is a meditation app that teaches B. Alan Wallace's *The Attention
Revolution* slowly, and grows a hand-drawn garden as you sit. Expo + React
Native, TypeScript, local-only — no account, no server, no payment.

The governing design goal is a **quiet** app. Nearly every product decision
trades engagement mechanics for calm. If a change would add streak pressure,
failure copy, badges, or a second way to watch the clock, it is wrong for this
codebase even if it works.

## Commands

```sh
npm start          # Metro dev server
npm test           # the unit suite (Jest)
npm run typecheck  # tsc --noEmit
npm test -- src/domain/__tests__/plots.test.ts   # a single file
npm test -- -t "cycles in order"                 # a single test by name
```

There is **no linter or formatter configured**. Match surrounding style by hand;
don't add one unless asked.

Before claiming work is done, run both `npm run typecheck` and `npm test`, and
**check jest's exit code**, not just its summary line — see the trap below.

## Architecture

```
app/                 screens only (expo-router, file-based)
  (tabs)/            Garden · You
  session/           start → tip → run → complete → advance  (outside the tab bar)
  onboarding.tsx     welcome → reminder → stage one, shown once
src/
  theme/             themes.ts (all colour), tokens.ts (space/shape),
                     typography.ts (type scale)
  store/             the ONLY module that touches persistence
  domain/            pure + tested: stages, progression, plots, plants, stats
  session/           useSession (clock), bells, notifications
  ui/                shared components, incl. the type-scale-aware <Text>
```

**Screens are thin.** They render and dispatch. They never compute progression,
derive plots, or reach for storage. If a screen is doing arithmetic about stages
or sessions, that logic belongs in `src/domain/`.

**`src/domain/` is pure.** No React, no native modules, no `expo-*` imports.
That is what makes it testable without a device, and it is why the suite covers
exactly the logic that is painful to check by hand.

**Data flow:** `src/store` holds three objects (`sessions`, `progress`,
`settings`) in Zustand, persisted to AsyncStorage as one JSON blob. Everything
else is *derived* — plots, streaks, which tip is next, whether to offer a stage.
Nothing derived is ever stored.

**Colour is read, not imported.** `settings.theme` names one of three palettes
in `src/theme/themes.ts`, and every component gets the live one from
`useColor()`. A `StyleSheet.create` is frozen at import and cannot repaint, so
colour props live in an inline style and only structure stays in the sheet.
`src/theme/tokens.ts` keeps what is the same in every theme — space, radius,
`hairline`, `organicCorners` — and is still a plain import.

### The store's public surface

Screens import from `src/store` only. **Nothing outside `src/store/index.ts` may
import the underlying `useStore`.**

- Reads (reactive): `useSessions` · `useProgress` · `useSettings` · `useHydrated`
- Writes: `recordCompletedSession` · `setStage` · `noteAdvanceOffered` ·
  `markTipSeen` · `updateSettings` · `completeOnboarding`
- Escape hatches (tests + dev panel only): `getState` · `__replaceState` · `__reset`

`src/store/persistence.ts` is the seam for swapping AsyncStorage for
`expo-sqlite` later. Bump `STORAGE_VERSION` and add a `migrate` branch for any
shape change — users have real gardens on their phones, and a bad migration
loses them permanently.

## Invariants — break these and the app is subtly wrong

**Session time is derived from the wall clock, never counted down.**
`src/session/useSession.ts` recomputes remaining time from `Date.now()` on every
250ms tick *and* on every return to the foreground. JavaScript timers stop when
the app is backgrounded, so a counted-down timer silently loses exactly the time
the user spent away. This is the most important thing in the codebase. If you
touch that file, re-verify by backgrounding the app mid-sitting.

**Exactly one sound ends a sitting.** Foreground: `useSession` cancels the
pending notification and rings the bell. Background: a notification was scheduled
on the way out and fires instead. The AppState handler schedules on leaving and
cancels on returning. Change one half without the other and you get a double
chime or silence.

**A plant's identity *and its place* are stored, not derived.** `Session.plant`
holds the key resolved at completion; `plantFor()` runs once per session, ever.
That is what makes adding species to `PLANT_KEYS` safe later — existing plants
never change, even though the same seed would now hash differently.

`Session.slot` is the same idea applied to position. A garden fills in order, so
`nextFreeSlot` decides where a plant lands — asked at the moment a sitting
finishes, never passed in. The slot is absolute across the whole garden — plot is
`slot / PLOT_SIZE`, cell within it is `slot % PLOT_SIZE`.

It is still **stored and never derived**, and linear planting makes that more
important rather than less. Gardens grown while the user picked their own dot
have holes anywhere in them, and those gardens are on people's phones: position
used to be array order, and deriving it again would silently rearrange them. It
is also why `Plot.cells` stays a sparse array and `nextDot` looks for the first
hole rather than the dot after the last plant — in a garden that has only ever
filled in order those are the same dot, and in an older one they are not.

**New fields need a default, not a migration.** `mergePersisted` in
`store/persistence.ts` merges `progress` and `settings` over their defaults on
every launch, because zustand's default merge is shallow and would otherwise
hand an old blob's `settings` straight through with the new key `undefined`.
`migrate` is only for real shape changes — `slot` was one, and its `v1 → v2` step
replays array order so existing gardens come back exactly as they were.

**`seenTipIds` is one flat list across all ten stages,** so tip ids must be
globally unique (`s3-07`, not `07`). A test enforces this; a duplicate would
silently skip a tip in another stage.

**Sentinels that carry meaning:**

- `progress.stageStartedAt === 0` → onboarding never finished; `shouldOfferAdvance` returns false.
- `settings.lastDurationMs === null` → no explicit choice yet, so the dial follows the stage's suggestion. `setStage` clears it so a new stage's proposal is actually heard.
- `settings.onboardedAt === null` → `app/(tabs)/_layout.tsx` redirects to onboarding.

**The root layout holds the splash until fonts *and* store hydration finish.**
Every screen below may therefore assume its data is present. Don't add
per-screen loading guards, and don't remove the gate.

**Abandoned sittings are never recorded.** `recordCompletedSession` is called
only from `onComplete`. There is no partial-credit path and there must not be
one — the garden is honest precisely because it only shows completed sittings.
Leaving early shows no message and no confirmation dialog.

## Product rules encoded in the code

| Rule | Where |
|---|---|
| One plant per completed session | `store.recordCompletedSession` |
| Plots of 108 (mala bead count); the plot is derived, the plant's slot is stored | `domain/plots.ts` |
| A garden fills in order; only the next dot answers a touch | `domain/plots.ts` → `ui/PlantGrid.tsx` → `app/session/start.tsx` |
| Whole minutes by default; seconds are opt-in | `settings.hideSeconds`, `ui/Clock.tsx` |
| Advance offered at ≥20 sessions **and** ≥21 days at stage; a decline is respected for 14 days | `domain/progression.ts` |
| The app proposes a stage; **the user confirms** | `app/session/advance.tsx` |
| Stage suggests a duration; every option stays tappable | `domain/stages.ts`, `ui/DurationDial.tsx` |
| Tips move forward in written order, then cycle | `domain/progression.nextTip` |
| One bell in, one out, nothing between | `session/bells.ts` |
| One daily reminder, off by default, no streak nagging | `session/notifications.ts` |
| The two figures are corner indicators, not cards — no label, no unit | `ui/Indicator.tsx`, `app/(tabs)/index.tsx` |
| Theme is taste, never behaviour: it changes values, never what the app does | `settings.theme`, `theme/themes.ts` |

Wallace's criterion for advancing is the state of your mind, not attendance. The
thresholds decide only when it is *reasonable to ask*.

## Design discipline

The visual language is **Karakuli**, the author's personal hand-drawn design
system (warm paper, one soft round-nib pen, colour that is earned), applied at
a near-austere setting: no washes, calm energy, and one accent — ink by default,
brick in the two loud themes. Its rules are encoded below; when in doubt, less
colour and more ink.

**Colour is earned, and almost only the garden earns it.** Touchability is
marked by shape — a fill, a 1.5px border, organic corners — and by the app's one
`accent`, which is ink in the Ink theme and brick in the other two. The accent
appears in exactly four places: the primary button's fill, the wobbly button's
fill, the breathing ring, and the screen switcher's travelling marker. Note
which slider that is: navigation earns the accent because where you are in the
app is worth the app's one loud colour, while the duration dial — a choice made
*inside* a screen — takes `Slider`'s `tone="quiet"` and a `paperDeep` marker.
Committing to something is Meditate's job, and it is the accent. Green
means *something grew* — plant strokes, and the garden's session count. The pen
brights (`penBlue/penOrange/penPink`) have exactly two licences: a plant's bloom
(the reward-garden colour moment), and the first-run hero's night sky
(`SittingFigure`). If a pen bright shows up in ordinary chrome, that's a bug.
**No hex literal may appear outside `src/theme/themes.ts`.**

**Three themes, and they vary values, not structure.** Ink (cream paper, accent
= ink) is the original and the default; Butter (butter paper, brick accent) and
Prose (near-white editorial paper, brick accent) are the two loud ones. Karakuli
allows an app exactly one accent; spending that licence three times was a
deliberate call, because the ground a plant is drawn on changes how the drawing
reads. What a theme may not do is add a colour that means something new. Butter
re-mixes the garden pens — green goes olive on a light warm ground and orange
disappears — and both brick themes drop `danger` to an oxblood, because a
warning that is the same colour as every button is not a warning.

**Two typefaces, hard boundary.** M PLUS Rounded 1c carries everything read for
information — timer, labels, nav, stats, buttons (500), headings (700), and the
teaching card body (400, the long-form reading weight). Shantell Sans is a
voice, not a reading face: the hand-scrawled app name and one-line felt captions
(`variant="hand"`), never a paragraph. If a sentence runs past a line, it goes
back to the body face.

**Hand-drawn touches are rationed.** Exactly four kinds exist: the wobbly
`Rule`, organic corner asymmetry (`organicCorners` — always seeded, never
random), hand-drawn arrows (`ArrowRight`, `ArrowLeft` — the way back out of a
sitting), and the single `wobbly` button (Meditate, and only it). The active
tab's scribble underline was the fifth and is gone: the sliding selector's
marker says "you are here" now, and an interface needs one way of saying it.
Hand-drawn check marks are sanctioned by the style but not yet drawn; nothing
beyond those is. The garden's next-dot ring is not a fifth kind — it is the
timer's ring at another size, which is the whole reason that geometry sits in
`ring.ts` rather than in the component that first wanted it. Every *code-drawn* path is cubic béziers with round caps and baked-in
wobble: no `Circle`, no `Rect`, no ruler-straight lines, no perfect arcs. The
icons no longer need the rule — they were drawn by an actual hand.

Fill is spent three ways and no others. Two marks are filled *instead* of being
stroked — the empty slot's dot (`Plant.tsx`'s `EmptySlot`) and the wobbly
button's own shape. The third is new and is a different thing: a plant's closed
paths are filled with **paper** behind their own stroke, so a leaf, a cap, a
berry and a bloom sit on the page rather than being holes in it. This is a
departure from the kit, which draws doodles `fill="none"` and sanctions fill for
UI surfaces alone, and it was taken once `PLANT_ZOOM` reached 1.85 and plants
began landing on top of each other: a cap you can read the next plant's stem
through is a tangle, not a garden. It stays a departure about *opacity*, not
about colour — the fill is always the ground, never a pen, so a garden of solid
colour would be a second and much larger change. Which paths qualify is read off
the drawings (`isShape`: a path that closes is a shape, one that does not is a
stroke), so re-tracing the plants cannot silently get it wrong.

The pen contract lives in `src/ui/pen.ts`: doodles draw at 2.8 on a 48-unit canvas,
heroes at 7 on 200, and hand-drawn UI marks (`Rule`) at hairline–2 on their own
tight canvas — so one hand appears to have drawn the whole app.

**The wobbly button is drawn, not styled.** `borderRadius` can give a box four
corners that disagree, but the four sides between them stay ruler-straight, and
a ruler-straight line is the one thing this pen never draws. So the button's shape is
a path: `src/ui/box.ts` builds a closed rounded rectangle whose corners land
within ±20% of nominal and whose sides belly one or two percent off true, filled
with the accent. `box.ts` is pure — no react, no svg,
the `ring.ts` precedent — so the geometry is checked without a renderer, and its
test walks the whole path rather than the knots, because the bellies bow
furthest between them.

Two things there are deliberate and cost real time to rediscover. Each side's
bow is a fraction of *its own* length, not of the box's shorter side: measured
against the short side, a 220pt-wide button's long edges move well under a point
and the thing comes back looking machined. And opposite sides disagree in sign,
because displacing top and bottom the same way bends the button like a banana
instead of making it look uneven. The wobble is a fixed table, unseeded — only
one control in the app is drawn this way, so it has one character rather than a
family of them, which is the opposite of `organicCorners`' problem.

It carries no outline. A drawn edge in a second colour was a statement only two
of the three themes could make — in Ink the accent *is* the ink, so there was
nothing for an edge to contrast with — and a shape outlined in Butter but not in
Ink is two shapes, which is more than a theme is allowed to be. The silhouette
says it in all three.

**Батон, the sleeping loaf cat, holds the quiet places** — the reminder step of
onboarding and the empty garden — and nowhere else. He never cheers; the app's
no-congratulation voice outranks mascot charm.

Use `<Text variant="...">` from `src/ui/Text.tsx` rather than declaring
`fontFamily`/`fontSize` inline, so the app's voice stays in `typography.ts`.

**Light theme only.** There is no dark mode; adding one was explicitly declined.

**The status bar is hidden everywhere** — `<StatusBar hidden />` at the root plus
`hidden: true` on the `expo-status-bar` plugin in app.json (the plugin config
only takes effect in a dev build; the component is what works in Expo Go). The
safe-area top inset stays: hiding the bar does not remove the notch.

**The ring breathes; it is not a progress bar.** `TimerRing` pulses on a 10s
cycle while a sitting runs, because the clock shows whole minutes and without it
nothing on screen moves for a minute at a time — a running sitting would be
indistinguishable from a frozen app. The ring is a wobbly near-circle, not a
perfect one, and its geometry is normalised against its own measured extent so
the wobble can't clip at the SVG edge. The elapsed arc behind it is deliberately
the quietest mark on the screen, and is `inkFaint` rather than green: green
means *something grew*, and elapsed time has not grown anything.

**At most one primary button per screen.** Any second action is `variant="quiet"`.

**Motion lives in `src/ui/motion.tsx`, and almost none of it loops.** An
*entrance* (`Sprout`, `Rise`) marks a first appearance; a *settle*
(`usePressSettle`) is feedback for a touch. Everything animates transform and
opacity only, so every driver is native. Three things loop and all three are
named exceptions, because in each the loop is the point rather than a
transition: the breathing ring, which owns its own; `Pulse`, which breathes the
garden's next dot to the same four-in six-out count so the app has one breath
rather than two that nearly match; and `Sway`, the garden's idle lean.

**`Sway` is a whole screen that never stops moving**, which is the largest
claim any loop here makes, so it is worth saying what earns it. It reports
nothing and asks for nothing: it does not accumulate, congratulate or keep
score, it is identical whether you sat today or not, and it stops the moment you
leave the tab. A garden moves in wind — that is the entire statement, and it is
the same one the burst makes about growth. The pen's rule holds too, because the
lean is a *shear*: a shear's determinant is exactly 1, so unlike a scale channel
it cannot break the rule that a doodle changes shape and never mass.

Its arithmetic is `src/ui/sway.ts`, pure and tested on the `ring.ts` precedent,
and three things about it cost real time to rediscover.

**One clock, and each plant's whole loop stored as a sampled table.** A hundred
and eight looping drivers is not a thing to do, so `useSway` runs a single
linear 0..1 ramp and each `Sway` reads its own window out of it with
`interpolate` — the same arrangement as the burst. Everything is periodic over
one turn *by construction* (a whole number of sways, one gust), so the ramp
restarts at 0 without a seam rather than being checked for one. Unlike `Pulse`,
it takes an `active` flag: the tab stays mounted behind the other one, so
stopping on unmount would leave it turning for the life of the app.

**`Sway` sits outside `Sprout`.** The composite is then `skewX · scaleY`, so a
half-grown plant leans half as far in pixels at the same angle. Inverted, the
lean is applied before the growth and is therefore unscaled — a plant squashed
to a fifth of its height swings as wide as a full one, which reads as a glitch
rather than as wind.

**The shape knob is a Möbius warp of the cycle, and the obvious formulation was
wrong.** Asymmetry — fast through upright one way, slow the other — is tempting
to write as `sin(a + b·sin a)`, but its speed carries a factor `(1 + b·cos a)`
that is *exactly zero* at `a = π` when `b = 1`. The plant halts dead at upright,
hangs, and starts again; decelerating in and accelerating out reads as two
twitches either side of the middle. The warp used instead has the Poisson kernel
`(1 − k²)/(1 − 2k·cos a + k²)` as its derivative, strictly positive for every
`k < 1`, so the motion never stops however hard the asymmetry is pushed. A test
pins the property rather than the formula: the slowest crossing measures 0.22 of
the busiest step, where the old warp gave 0.0001.

That trade moves the cost to `SWAY_KNOTS`, which is why it is a fidelity setting
rather than a taste one — the table is straight lines between knots, and the
harder the shape is pushed the fewer of them fall across the fast crossing,
which is where a corner shows. Set it against the bench's worst-corner readout,
not by eye.

**A lean has to come out of the cell, because sideways there is nowhere else.**
`above` and `below` become padding on the grid, but the grid is *centred*, so
widening it moves nothing at all — the leftmost cell stays exactly where it was.
`field.ts` therefore divides the width by `COLUMNS + 2 * SWAY_REACH`, and the
reach is derived from the drawings (ink spans x=8.6..39.4 of the 48-unit page,
and its top stands `ROOT_Y - 5` above the root it pivots on) rather than chosen.
Every term is proportional to the cell, which is what stops "how wide is a cell
when its own margin depends on the cell" from needing to iterate.

`Pulse` is the nearer of the two to something this app does not do. The ring
reports — a sitting is running — while a pulsing dot invites, and inviting is a
step towards an engagement mechanic. What keeps it honest is that the swing is
small enough to notice only once you are already looking at the garden, and that
nothing about it accumulates, congratulates, or keeps score: miss a week and it
is doing exactly what it does now.

**The field is twelve across, so 108 lands on nine rows and a whole plot fits
one screen.** It used to be six across, where a cell was 60pt wide and a dot was
a 5.5pt blob adrift in it, and the plot ran two and a half screens deep. Dense,
the dots read as one texture the grown marks sit in rather than as a list of
buttons — which is what the garden is for. Two costs, both accepted: the tap
target is a 30pt cell rather than a 60pt one, and `field.ts` floors
the cell to a half point and draws the grid at exactly twelve of them, because
twelve fractional widths can total a hair over a fractional container and throw
the last cell onto a row of its own.

That tap target used to be cheap — a hundred dots each started a sitting where
you touched, and a mis-tap spent nothing because the slot was only committed when
the sitting finished. Now exactly one dot answers a touch at all, so the argument
has to be made differently: `PlantGrid` gives that one `Pressable` a `hitSlop` of
half a cell, which grows the target without moving the lattice or the ink. The
drawing stays a third of an inch; what you can hit is twice that.

The field's arithmetic lives in `src/ui/field.ts`, which is pure — no react, no
svg, the `ring.ts` precedent — because the guarantee it makes is one worth
checking without a renderer. `COLUMNS`, `PLANT_ZOOM`, the page the plants are
drawn on and the line they stand on are all there, and `PlantGrid` asks it for
one `Field` rather than doing the sums itself.

The two drawings in that field are sized differently, and `ART_SHARE` is why.
The share is derived so that art plus a full scatter cannot cross the cell's
edge, and the empty dot takes it neat — an unplanted field has to stay on its
lattice or the whole thing looks spilled. A plant spends the guarantee
(`PLANT_ZOOM`, 1.85), because a plant does not fill its canvas: rooted at y=43 on
a 48-unit page with a margin for the nib, its ink is around two thirds of the
width measured out for it, so at cell size the drawing is small and the field
reads as sparse. Drawn getting on for twice as large, the ink fills the cell and
the canvas margin is what hangs over. Plants may touch at the edges; a garden where
they do is a garden.

**A dot and a plant stand on one line, and `GROUND` is where it is.** They used
to be centred in their cell instead, which sounds like the same thing for both
and is not: a dot's ink *is* the middle of its canvas, while a plant's root sits
`(ROOT_Y - CANVAS / 2) / CANVAS` below the middle of its own. At `PLANT_ZOOM`
that came to about two thirds of a cell, so every plant grew from well below the
dot that started it. In a row holding some of each it read as a rendering fault,
and it quietly contradicted the rule that a sitting grows where you touched.
`PLANT_ZOOM` did not cause it — the gap is a third of a cell even at zoom 1 —
but each increase widened it, which is why it arrived by degrees.

So neither drawing owns the line. `field.ts` puts it at `GROUND` of a cell and
moves each mark by its own distance from it, which is what makes them land
together at any zoom and any cell size; a test asserts exactly that, because it
is the sort of guarantee that stops being true silently. The value is a look and
not a derivation: every value aligns them, and what it picks is which of the two
pays for it. At 0.8 they split it about evenly. An empty garden is identical at
any value — a uniform lattice has nothing to compare itself against — so this
only ever shows itself in a half-planted row.

Two things fall out of it. `Sprout` now pivots on the root rather than on the
bottom of the canvas, a nib's margin lower, which used to lift every root a
couple of points at the peak and set it back down. And **dots draw over plants**
(`styles.above`), which they never had to before: a plant stands about a cell and
a quarter tall from its root, so once its root is on the dots' line its head
necessarily reaches past the ground line of the row above, and its shapes are
filled with paper. A hole left in a planted field would otherwise have its dot —
and the ring marking where to sit next — quietly painted over by the plant below
it. A dot showing over a leaf reads as ground behind the garden, which is what it
is; a target you cannot see does not read as anything.

**The dot a sitting would fill next wears a drawn circle, and it breathes.** A
field of a hundred alike marks is the point of the garden and also what makes
any one of them impossible to pick out. The ring is a locator and not a prize:
it says nothing about you, and it is gone the moment that dot is filled. It
circles an *empty* dot rather than the newest plant on purpose — marking what
you grew is a record and the garden is already that, while marking where you
would go next is the only thing on the screen about carrying on. Which dot that
is comes from `nextDot`, the first hole in the plot, so it agrees with where
`nextFreeSlot` would actually plant.

Since planting became linear it is also **the button** — the one mark in the
field that answers a touch — which is a better job than the one it was drawn for
and needs no change to the drawing. It is also what quietly fixed an overlap: a
plant's head stands about 12.5pt above its own cell, so a plant in the row
*below* an empty dot used to reach up over that dot's ring, and `zIndex: 1` meant
the ring won and looked wrong. That case is a hole with a plant after it, which
only free planting could make. Filling in order, everything past the next dot is
empty, so nothing is ever drawn over it. Older gardens still have such holes and
will show the overlap until they fill; it heals itself and is not worth code.

Its colour is `inkSoft`: not the accent, whose four places are spoken for; not
green, which means something grew and nothing has grown here yet; and not
`inkFaint`, which is what the dot inside it is drawn in — a ring in the colour of
the thing it circles is not a ring.

The geometry is `ringPath` at another size, which is why that function takes a
centre as two numbers rather than one. But `ring.ts`'s wobble is a couple of
percent, and a couple of percent of an eleven-point ring is a sixth of a point:
at the timer's 210pt it reads as a hand, and here it read as a compass. So the
small ring is tilted and run a little long on one axis (`RING_LEAN`), which is
what a circle closed in one movement actually does — and because the uneven
scale carries the nib with it, the line thickens through the turn. Fixed and
unseeded, like every other wobble here: one ring is on screen at a time, so it
wants one character rather than a family of them.

What the overhang costs is padding on the grid, and it is not optional. A plant
drawn past its cell needs room outside it, and the top row has none: a scroll
container clips at its own edge whatever its children say about `overflow`, so
the first row of flowers came back decapitated — heads sheared flat, which is
subtle enough to read as a drawing style rather than as a bug. The two edges
reserve different amounts, and both are worked out from where the ground line
put things rather than written down: a sprout scales *about* that line, so each
end swings out from it by `SPROUT_PEAK`, which is read off `GROWTH` rather than
stated twice. Lifting the plants sent most of the old bottom margin to the top,
where `below` is now not much more than a scatter and the lowest mark is often
the dot rather than the plant. A louder pop that quietly outgrew the space kept
for it is the bug that arrangement exists to prevent.

**The garden bursts on every visit, not once per launch.** `useBurst` runs one
shared 0..1 clock and each `Sprout` reads its own window out of it, so 108 cells
cost one driver. `app/(tabs)/index.tsx` restarts it from `useFocusEffect` — the
tab stays mounted, so a mount effect would fire exactly once in the life of the
app. Delays are seeded from the slot (`hash32('burst-' + slot)`), never random:
a field that re-rolled its timings would be a different drawing each visit.

The whole field takes about a second and a half — 1000ms per doodle scattered
across 450 — and each one is **squash and stretch**, not a fade-up. `GROWTH` in
`motion.tsx` is the curve, written as frames rather than parallel arrays because
the character is in how the channels disagree at a moment. The doodle shoots
past full height while still pinched narrow, and everything after that is it
wobbling to a stop: overshoot nearly two thirds, then a third, then a sixth,
each swing about half the one before. That halving is what a damped spring does, and it is
the difference between jelly and a bounce. `scaleX` and `scaleY` must never
reach their extremes together, or it reads as a bubble inflating rather than as
something growing — every frame multiplies out to within a few percent of 1, so
the doodle changes shape and never mass.

This burst used to be over in under half a second, on the argument that it must
not become a thing you wait through. It is now something you watch, which is a
deliberate reversal and the one place the app spends time on pleasure: the
garden is the screen worth looking at rather than using, and `usePullToReplay`
exists precisely so you can ask for it again. What that costs is written into
`PlantGrid`'s `above` — a sprout at its peak stands two thirds again over its
own root, and a second of it is long enough that a top row trimmed by the scroll
edge is something you would sit and watch happen.

**Pulling down at the top of the garden plays it again** (`usePullToReplay`).
The garden is the one screen here worth looking at rather than using, and the
burst was otherwise only reachable by leaving the tab and coming back.

It reads the gesture off the scroll events rather than using a `RefreshControl`,
which is the usual way to get a pull at the top: that would put a Material
spinner on the paper, and a system progress indicator is a promise that
something is loading. Nothing is loading. The read has to be indirect because
**Android reports no overscroll** — the offset simply stays at 0 while you pull,
so there is no negative number to notice. What there is: a drag that *began* at
the top and never moved the content can only have been downward, since upward
would have scrolled. iOS bounces and reports a negative offset, which fails the
same `> 0` test, so one rule covers both.

Photographing it needs a trick, since half a second is faster than a screencap
round trip: multiply `SPROUT_MS` and `BURST_SPREAD_MS` by 8, shoot mid-burst,
then restore and `diff` against a backup to prove you did. On a device, issuing
`adb shell input swipe` and `screencap` back to back in one command is fast
enough to land inside the burst without slowing anything down.

**One sliding selector, used twice.** `src/ui/Slider.tsx` owns where the marker
is and how it travels; the caller owns what each item draws and what the row
sits in. The screen switcher (`SliderNav`) floats in a bar over the page; the
duration picker floats on bare paper. Items are a fixed width by contract, which is
what keeps the travel to a single `translateX` and therefore on the native
driver — and means there is nothing to measure and no frame where the marker is
in the wrong place. It is silent: the kit allows this one navigation a sound,
but this app rings one bell in, one out, and nothing between.

**The duration dial has no container.** Six numbers with air between them are
already legible as a row of choices; the card that used to hold them was a box
drawn around something that did not need one, and the heaviest mark at the foot
of a screen whose whole argument is that it is quiet. Small boxes with generous
gaps (38 × 36, gap 10) rather than large boxes packed together — both fit the
same width, only the second breathes, and the marker then reads as having
arrived somewhere rather than as one cell of a strip. Selection is carried twice
over, by the soft marker and by the number darkening from `inkSoft` to `ink`;
what the unselected ones must never do is fade, because every length is
available at every stage and five greyed-out numbers would say otherwise.

The chosen length is printed nowhere else. A large figure above the button said
exactly what the dial's own marker says, in a place you cannot change it.

## Toolchain traps already hit

These cost real time. Don't rediscover them.

**`expo-notifications` must never be imported at module scope.** On Android in
Expo Go it throws the instant it is imported (push was removed from Expo Go in
SDK 53), and a throw during module evaluation takes down the entire route tree —
the app hangs on the splash with `Cannot read property 'ErrorBoundary' of
undefined`. **A try/catch around the `require` is not sufficient**: the module
also reports through React Native's global error handler, so a caught throw still
raises a full-screen overlay. `src/session/notifications.ts` detects Expo Go via
`Constants.executionEnvironment` and never requires the module there. Keep
`configureNotificationHandler()` inside a `useEffect`.

Consequence: in Expo Go the daily reminder and the backgrounded-session
notification silently no-op. Both work in a development build.

**Fonts ship as Latin subsets in `assets/fonts/`, not from npm.** M PLUS
Rounded 1c carries CJK coverage — the full face is ~3.3MB *per weight*, so three
weights would put ~10MB of font binary behind the splash to set English text.
`scripts/subset-fonts.sh` (needs `uv`; fetches `pyftsubset` ephemerally) subsets
the TTFs from the `@expo-google-fonts` packages, which stay in devDependencies
only as the regeneration source. Re-run it after bumping them; add `U+0400-04FF`
to its ranges if the app ever grows Cyrillic text. The earlier lesson still
stands underneath: never import an `@expo-google-fonts` package by its root —
the root `require`s every weight.

**A `transformOrigin` must be an array, never a string, if it is not a whole
percent.** React Native parses a string origin with
`/(top|bottom|left|right|center|\d+(?:%|px)|0)/g` — integer digits, no decimal
point. `'50% 89.58333333333334%'` therefore does not fail; it matches
`58333333333334%` out of the middle and pivots the view fifty-eight trillion
percent down its own height, which throws it past the horizon. `ROOT_SHARE` is
43/48, so every plant animation lands on exactly this. The array form skips that
parser: `src/ui/field.ts`'s `ROOT_ORIGIN`, which `Sprout` and `Sway` both use.

It is worth knowing how completely this hides. There is no error, no warning,
and no layout change — a transform does not affect layout, so the cells, the
scatter and the next-dot ring all stay exactly where they belong and only the
drawings disappear, which reads as a data problem rather than a style one. And
**it does not reproduce in the web preview**, because `react-native-web` hands
the origin to CSS, which reads decimals perfectly well: the browser drew a
correct garden the whole time the phone drew an empty one. `origin.test.ts`
pins it against RN's own parser.

**Do not add `babel.config.js`.** SDK 57 applies `babel-preset-expo` by default.
Adding the config file the docs show makes Metro demand `babel-preset-expo` as a
top-level dependency, which isn't hoisted — bundling fails immediately.

**`react-native-reanimated` and `react-native-gesture-handler` were deliberately
removed.** Reanimated 4 needs `react-native-worklets`, which npm pruned, and
nothing in the app needs either. Don't reinstall them speculatively; if an
animation is genuinely required, RN's built-in `Animated` covers it.

**`.npmrc` sets `legacy-peer-deps=true`** because `@expo/metro-runtime` pulls in
`react-dom@19.2.8`, whose peer range outruns Expo's pinned `react@19.2.3`.
`react-dom` is web-only and this app is iOS/Android, so the mismatch is inert.
Without it, every `npm install` fails.

**`tsconfig.json` needs `"types": ["jest"]`,** or every test file fails typecheck
with "Cannot find name 'describe'".

**`@react-native/jest-preset` is an explicit devDependency** — `jest-expo` needs
it as a peer and does not pull it in.

**Jest's summary line counts tests, not suites.** A suite that fails to *run*
(usually a native import that can't resolve) reports `0 failed tests` and looks
green. Always check `npm test`'s exit code. This masked a broken suite once
already, which is also why `src/ui/time.ts` holds the pure time formatting rather
than `src/session/` — a pure function must not sit in a file that imports
`expo-audio`.

**An empty garden and the onboarding screen is what `__reset()` looks like.**
The dev panel's Reset clears `settings` back to `initialSettings`, and
`onboardedAt: null` is what redirects to onboarding — so a wiped garden after
pressing it is the button working, not hydration failing. Check that before
going looking for a persistence bug.

The upgrade path itself is pinned by `src/store/__tests__/hydration.test.ts`,
which boots the store cold against a real version-1 blob and asserts the garden
comes back with its slots, its settings, and no onboarding redirect. If that
suite is green, hydration is not your problem.

## Content notes

`src/domain/stages.ts` holds all ten stages and their tips. The tips are
**original paraphrase** — the practice restated in the app's voice — not
quotation from the book. Keep it that way.

Depth is uneven on purpose: stages 1–4 carry ~15 tips each because that is where
a beginner spends months; 5–10 carry ~5. **The practice-to-stage boundaries in
the later stages still need a careful pass against the book** before they are
trusted as instruction. Padding stage 9 without that pass would be inventing
depth we haven't earned.

Voice: plain and faintly clinical, like Wallace. Not mystical. No exclamation
marks, no congratulation, no pep talk.

## Art status

**Icons are traced from real drawings.** The six in `src/ui/icons.tsx` were
drawn by hand on a Boox, traced to outlines, and generated into
`src/ui/icons.paths.ts` — so they are **filled** rather than stroked, and use
neither pen in `pen.ts`. The nib is already in the outline; stroking a traced
mark would draw a second, even line around something that is not even. They
still take their colour from the live theme, which is the whole reason this is
path data and not PNGs.

The loop is one command — `npm run art` — and it is documented in `art/README.md`,
with the drawing guidelines in `art/DRAWING.md`:
`drawing-sheets.mjs` prints a jig, you draw on it, `trace-art.py` registers the
scan off four corner marks and potraces each box, `art-to-code.mjs` writes the TS.
Two things there are worth knowing before touching it. Marks are normalised **by
their printed box, never by their own bounding box** — fitting each drawing to
its own extent silently rescales every stroke width on the sheet, which is
invisible until all eighteen sit together. And the trace runs on a *blurred*
upscale: unsmoothed, potrace faithfully follows JPEG ringing along every edge and
the same six icons cost 41KB of path data instead of 16KB, for no visible gain.
The run prints a measured pen weight against the nominal 2.8; outside 80–125% the
sheet needs re-drawing, not rescaling.

The **box size is set by the device's pen, not by taste.** A Go 10.3's brush stops
at 2.0mm, so the original 480px box asked for a stroke no brush could lay down and
both passes came in light (34%, then 77%, which was the hardware ceiling). At
370px, the widest brush *is* the nominal nib — the instruction becomes a setting
rather than a judgement. Every sheet must keep the same box: marks drawn in
different-sized boxes carry different stroke weights into the same app, and that
is invisible until they sit together. `art/templates/gen-480/` keeps the retired
geometry so scans drawn on it stay reproducible.

**Plants** (`src/ui/Plant.tsx`) are still Karakuli pen doodles — twelve species,
each with a fixed bloom colour that is a property of the species, never of the
session. They are next in line to be traced, and `PEN_DOODLE` retires with them.
Identity (`src/domain/plants.ts`) is kept separate from rendering precisely so
that stays a one-file change. `SittingFigure` and `Baton` follow the pen contract
and come from the Karakuli kit's hand.

**Bells are still placeholder** — synthesised inharmonic bowl tones. Regenerate
with `node scripts/generate-placeholder-bells.mjs`, or replace
`assets/audio/bell-*.wav` with real recordings.

## Verifying on a device

Expo Go is the fast path and stays the default loop — reload beats a five-minute
gradle build.

```sh
adb reverse tcp:8081 tcp:8081        # more reliable than the LAN URL
npm start
adb shell am start -a android.intent.action.VIEW \
  -d "exp://127.0.0.1:8081" host.exp.exponent
adb exec-out screencap -p > /tmp/shot.png    # then actually look at it
```

Metro's output is where runtime errors show up; a stuck splash almost always
means a module threw during evaluation.

`./build-android.sh` is for what Expo Go cannot reach: **both notification
paths** and the `hidden: true` status-bar plugin config. It builds a release
APK, installs it over the previous one, and launches it. The Android SDK is
already installed at `~/.local/opt/android-sdk` (set `ANDROID_SDK_ROOT` if it
moves); `ANDROID_SERIAL` picks between phones.

`android/` is generated by prebuild and gitignored — `app.json` is the source of
truth, so never hand-edit the native project. `android.package` is
`com.justsit.app`, which is *not* Expo Go's package: the two have separate
storage, and a garden grown in one is invisible to the other.

The **You tab has a `__DEV__`-only panel** (seed sessions, jump stages, arm the
advance offer, reset). Use it — the interesting states of this app are the slow
ones, and waiting three weeks for a stage offer is not a test strategy.

## Judging layout: the web preview

The phone is one screen shape, and this app gives its slack to `flex: 1` on every
screen — so the same layout breathes very differently at an iPhone SE's 667pt and
a CMF Phone 1's 911pt. `npm run web` runs the *real* app in a browser, where the
shape is yours to choose.

```sh
npm run web                                     # localhost:8081
node scripts/preview-shot.mjs /tmp/s.png 411 911 /    # then actually look at it
```

Screen shapes worth checking, in dp:

| Device | dp | ratio | insets, top/bottom |
|---|---|---|---|
| iPhone SE | 375 × 667 | 16:9 | `?top=0&bottom=0` |
| iPhone 15 | 393 × 852 | 19.5:9 | `?top=59&bottom=34` |
| CMF Phone 1 | 411 × 911 | ~20:9 | the default, 46/24 |
| 21:9 outlier | 412 × 961 | 21:9 | `?top=24&bottom=24` |

The insets are the preview's weak point, since a browser reports none and no
emulation can supply them. To calibrate a new device: render a screen with
`?top=0&bottom=0`, screencap the same screen on the phone, and difference the
position of one mark in each — the back arrow for the top, the nav dock for the
bottom, neither of which moves with content.

In a browser these go in the device toolbar as custom devices; **VisBug** (a free
extension, Chrome and Firefox) is the other half — it lets you drag and arrow-key
any element on the live page and read the distances, so a spacing decision can be
made by eye before anything is written down. Its edits are inline styles and are
meant to be thrown away; the number is the deliverable.

**Web is a preview target, not a platform.** No web build ships. `react-native-web`
renders flex, spacing and proportion faithfully — which is what you go there to
judge — but text metrics and SVG rasterisation differ a little from native, so
decide in the browser and confirm on the phone.

**And it is honest about proportion but not about size.** A 411px frame on a
desktop monitor is physically about half again as wide as a 411dp phone, and it
is read at desk distance rather than in the hand — so anything whose whole
question is *how much* comes out too small when it reaches the device. The sway's
amplitude was chosen in `anim-lab.html` at 5°, which is 3pt of travel at the tip,
and on the phone it was barely visible. Shape, timing and layout are decided in
the browser; amount is decided in the hand. Three things needed handling for
it to tell the truth:

- **`src/ui/webInsets.tsx` / `.web.tsx`.** A desktop browser answers
  `env(safe-area-inset-*)` with zero however small the window, and no device
  emulation can fake it, so the whole app would sit 24pt high and the floating nav
  would land on the gesture bar. The web file supplies insets through
  `SafeAreaInsetsContext`, which is where the library's web `SafeAreaView` and
  `useSafeAreaInsets` both read from — so `Screen` and `SliderNav` are corrected
  without either knowing. `?top=24&bottom=24` overrides them per frame. The native
  file is a pass-through; Metro picks by extension, so no part of the web one
  reaches a device.
- **`expo-notifications` is not loaded on web**, added to the same `UNSUPPORTED`
  guard that keeps it out of Expo Go on Android.
- **`react-dom`, `react-native-web` and `@expo/metro-runtime`** are in
  `dependencies` because `expo install` puts them there. Nothing in `app/` or
  `src/` imports them; they exist only for the web bundle.

`@react-native-community/datetimepicker` has no web build and degrades to `null`
with a warning, so the reminder picker is inert in the browser. Nothing else is.

`scripts/preview-shot.mjs` drives Chromium over the DevTools protocol rather than
passing `--window-size`, because macOS clamps a window to roughly 500px wide — a
naive headless shot of a 411pt phone lays out at ~500 and captures the middle of
it, which looks exactly like a layout bug and is not one.

## Tuning the garden's motion: the bench

`tools/anim-lab.html` is the garden's motion on sliders — a **Burst** tab for the
sprout curve and a **Sway** tab for the idle lean. Open it straight off disk — no
server, no build step, nothing outside the one file.

```sh
open tools/anim-lab.html
python3 tools/lab-data.py    # re-lift the drawings after redrawing one
```

It exists because the curve had been tuned three times by editing `GROWTH`,
reloading, and watching a two-and-a-half-second animation go past once. The part
that is usually wrong is the *settle*, and at 25pt a 3% overshoot is a pixel.

The five sliders are a damped spring — peak, damping, swings, rise, area — and
the frame table is generated from them, not edited. Two things fall out of that
which are worth keeping: the swings decay by construction, and `scaleX` is
`area / scaleY`, so the channels cannot reach their extremes together however
the knobs are set. Its defaults are the shipped table, and it
reproduces it line for line — if the two ever disagree, one of them has been
edited by hand and the bench is the one to trust. The output block is paste-ready
for `src/ui/motion.tsx`; nothing writes to the repo, which is what keeps the
bench out of the app's dependency graph.

**It is a copy, and three details are why it can be trusted.** The interpolation
is piecewise-linear clamped at both ends — what `Animated.interpolate` does, not
a CSS easing. `transform-origin` is `bottom`, because a plant grows from its
root. And the start times come from the same `hash32`, so a slot sprouts when it
would sprout in the app. Change any of those and the bench is a nice animation
of something else. The `.scroll` box clips like the real ScrollView too, so the
top row's overhang is judged honestly rather than hidden.

What it does *not* reproduce: which species grows where. The app resolves that
from a session id at completion; the bench hashes it off the slot, so the field
is varied and stable but is nobody's real garden. As with the web preview,
decide here and confirm on the phone.

**The Sway tab is the same argument applied to an idle lean**, and it is where
the question "each plant on its own, or one wind crossing the field" gets
answered by eye rather than in prose. It is one model, not three modes:
`coherence` runs from every plant on its own seeded phase to a single travelling
wave, and the Independent / Wind field / Gusty buttons are points in it. The
tabs swap which knobs and which output block you see, never which animation
runs — the burst and the sway both play, because the handoff between them is the
part most likely to look wrong.

Three details there carry the same weight as the burst's three. It runs off
**one clock**, with each plant's whole loop stored as a sampled table, because
that is exactly what `Animated.interpolate` can read off a single looping
`Animated.Value` — a sway tuned with a per-plant period would be one the app
cannot drive natively for 108 cells, and the bill would arrive after the tuning.
The sway wrapper sits **outside** the sprout, so the composite is `skewX·scaleY`
and a half-grown plant leans half as far in pixels at the same angle; inverted,
a squashed plant swings as wide as a full one. And the lean is a **shear**,
whose determinant is exactly 1 — so unlike a scale channel it cannot break the
rule that a doodle changes shape and never mass. Everything is periodic over one
turn of the clock by construction (a whole number of sways, one gust), so the
loop closes without a seam rather than being checked for one.

The phase seeds off the hash's **low** bits — `(hash32('sway-' + slot) % 4096)`
— as `burstDelay` and `slotOffset` already do. FNV-1a's top bits run close to
linear in the last character of a short key, so dividing by 2³² hands back a
near-monotone ramp across `sway-0`…`sway-11`, and the whole field drifts in step
at coherence 0: the one thing coherence 0 exists to prevent.

**The `shape` knob is a Möbius warp of the cycle, and the obvious formulation
was wrong.** Sway asymmetry — fast through upright one way, slow the other — is
tempting to write as `sin(a + b·sin a)`, but that carries a velocity factor
`(1 + b·cos a)` which is *exactly zero* at `a = π` when `b = 1`. The plant stops
dead at upright, hangs, and starts again; decelerating in and accelerating out
reads as two twitches per swing, and since the table is straight lines between
knots, the flattest part of the curve is also where the linear corners show
worst. The warp used instead has the Poisson kernel
`(1−k²)/(1 − 2k·cos a + k²)` as its derivative, which is strictly positive for
every `k < 1` — so however hard the asymmetry is pushed, the motion never stops.

That trade moves the cost to the knot count, which is why `knots` is a fidelity
setting rather than a taste one and why the panel prints the worst velocity
corner in the table. Pushing `shape` to 1 compresses the fast crossing into
fewer samples: at the current settings 32 knots leaves a 20°/s corner and 64
brings it to 12, while backing `shape` to 0.6 gets there at 32. Set it against
the number, not by eye.

The Room panel is a finding the sway forced out. `above`/`below` budget the
vertical overhang and nothing budgets the sideways one, and sideways has no
padding to hide in — the grid is centred, so widening it moves nothing. At the
shipped geometry a plant already reaches about 1px past its cell at rest, and a
3.5° lean makes that 4.9px against 1.5px of room, so the outer columns get
shaved. **Make room** shows what fixing it costs: the cell gives the width up
(30 → 28.5pt at 9°), and the output block prints the closed form.
