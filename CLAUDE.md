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

The governing design goal is a **quiet** app, and quiet is about voice rather
than austerity. It grows, it offers, it counts days, it keeps what you wrote
down; what it never does is raise its voice about any of that. Engagement is
allowed here where the user is the one choosing — whether to carry the garden
on when the bed fills, which of three plants a sitting grew, whether to write
anything at all.

The guardrails are what keep it from becoming a game, and none of them is
negotiable. **No congratulation:** nothing here tells you you did well. **No
failure state:** a missed day is silence, nothing withers, and no copy mentions
what you did not do. **Rarity is never labelled** — a tier is scarcity in
`plants.ts` and appears nowhere in the interface. **One bell in, one out,
nothing between.** And **a plant never moves or changes** once it is in the
ground. A second way to watch the clock is still wrong.

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
  garden/            grow — the ask when the bed is full      (outside the tab bar)
  notes/             the pile · one note                      (outside the tab bar)
  streak.tsx         your days — week, month, two runs        (outside the tab bar)
  onboarding.tsx     welcome → reminder → stage one, shown once
src/
  theme/             themes.ts (all colour), tokens.ts (space/shape),
                     typography.ts (type scale)
  store/             the ONLY module that touches persistence
  domain/            pure + tested: stages, progression, plots, plants, notes,
                     stats, hash
  session/           useSession (clock), bells, notifications, reminder lines
  ui/                shared components, incl. the type-scale-aware <Text>
```

**Screens are thin.** They render and dispatch. They never compute progression,
derive plots, or reach for storage. If a screen is doing arithmetic about stages
or sessions, that logic belongs in `src/domain/`.

**`src/domain/` is pure.** No React, no native modules, no `expo-*` imports.
That is what makes it testable without a device, and it is why the suite covers
exactly the logic that is painful to check by hand.

**Data flow:** `src/store` holds four collections (`sessions`, `notes`,
`progress`, `settings`) in Zustand, persisted to AsyncStorage as one JSON blob.
Everything else is *derived* — plots, streaks, which tip is next, whether to
offer a stage, what a sitting was worth, which plant carries which note. Nothing
derived is ever stored.

**Colour is read, not imported.** `settings.theme` names one of three palettes
in `src/theme/themes.ts`, and every component gets the live one from
`useColor()`. A `StyleSheet.create` is frozen at import and cannot repaint, so
colour props live in an inline style and only structure stays in the sheet.
`src/theme/tokens.ts` keeps what is the same in every theme — space, radius,
`hairline`, `organicCorners` — and is still a plain import.

### The store's public surface

Screens import from `src/store` only. **Nothing outside `src/store/index.ts` may
import the underlying `useStore`.**

- Reads (reactive): `useSessions` · `useNotes` · `useProgress` · `useSettings` ·
  `useHydrated`
- Writes, the garden: `recordCompletedSession` · `chooseOffer` · `growGarden`
- Writes, the notebook: `addNote` · `updateNote` · `deleteNote`
- Writes, the rest: `setStage` · `noteAdvanceOffered` · `markTipSeen` ·
  `updateSettings` · `completeOnboarding` · `resetProgress`
- Escape hatches (tests + dev panel only): `getState` · `__replaceState` · `__reset`

`src/store/persistence.ts` is the seam for swapping AsyncStorage for
`expo-sqlite` later. `STORAGE_VERSION` is **4**; bump it and add a `migrate`
branch for any shape change — users have real gardens on their phones, and a bad
migration loses them permanently.

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

**A sitting's plants — the species *and* the dots — are stored, never derived.**
`Session.plants` is a list of `{key, slot}`, one entry per plant, written when
the offer is chosen and never rewritten afterwards. Both halves have to be
stored, for different reasons: the species, because adding to `PLANT_KEYS` would
make the same seed resolve elsewhere and existing plants must never change; the
dot, because deriving position from array order again would rearrange a garden
the moment anything about that order changed. That is also why `Plot.cells`
stays a sparse array and `nextDot` looks for the first *hole* rather than the
dot after the last plant — a bed that fills in order has those in the same
place, and the hole is the reading that cannot put a plant on top of one already
there whatever else is in the ground.

Where the plants go is not carried through the sitting, and there is no
parameter for it. `recordCompletedSession` takes `startedAt` and `durationMs`
and nothing else: a garden fills in order, so the first plant takes the first
free dot and a bundle carries on from there. A `slot` travelling from the tap to
the bell would be a request that had survived twenty minutes and might name a
dot something else had since grown in — the reason it existed was free planting,
and free planting is gone.

It writes the first offer immediately, so a session never exists without plants:
kill the app on the completion screen and the sitting is still in the ground, at
the cost of it being the offer nobody picked.
`chooseOffer` is the only thing that ever rewrites them, and only for the newest
sitting — its plants are the tail of the used slots, so replacing them cannot
land on a dot something else has grown in. It refuses silently rather than
throwing, because it runs on the one screen that has something to show for the
last twenty minutes.

**What a sitting was worth is derived, and none of it is stored.**
`offersForSession` answers from the session and the sittings before it, so the
trio on the completion screen survives the app being killed underneath it, and
there is one answer to "what was this sitting worth" rather than a stored one
and a computed one to be kept in step. Its two derived inputs are read from
*different* moments, and each from the only one that makes it mean anything —
see the milestone note under the product rules.

**The garden is one bed, and it grows.** `progress.gardenSize` is how many dots
it holds today, and a slot is simply a position in it — the first dot is 0 and
there is nothing before it. There is no sequence of gardens and no archive: the
rows filled a year ago are the same drawing, a long way back up the same bed.
`nextFreeSlot` answers null when the bed is full, and null is not a failure: it
is the question `app/garden/grow.tsx` asks.

**The bed only ever widens while it is a single row, and that is the whole
reason the ladder has the shape it does.** It grows by `nextGardenSize` and by
nothing else — 3, 6, 12, and from twelve on a row of twelve at a time, so 24,
36, and up through 108, the mala at nine rows, and past it.

`PlantGrid` derives both the cell a plant is drawn in *and* the wind it leans in
from `slot % cols` and `Math.floor(slot / cols)`. A bed whose **width** changed
under a planted dot would therefore re-flow that plant into a different cell and
a different gust, which is "a plant never moves once it is in the ground",
broken. So width may change only while the bed is one row, where the row is
always 0 and the column is always the slot and `cols` does not enter the mapping
at all. Every widening on the ladder happens on a bed that is *full* — and
`growGarden` refuses on a bed with room left in it, which is both what makes the
grow screen's button safe to press twice and the only thing standing between the
ladder and a widening with plants in a second row. From twelve up the width is
frozen and only rows are added.

That guarantee is two modules agreeing, and they cannot import each other:
`nextGardenSize` in `domain/plots.ts` steps the ladder, `shapeFor` in
`ui/field.ts` cuts the bed, and twelve is written down in both — as the ladder's
last rung in one and as `COLUMNS` in the other. `growing the bed, dot by dot` in
`src/ui/__tests__/field.test.ts` is what holds them together: it walks every
rung from the starter bed past a mala and asserts that no planted slot changes
column or row, that a widening only ever lands on a one-row bed, and that a step
above the fold is exactly `COLUMNS` and exactly one more row. It is the sort of
guarantee that stops being true silently, with every other test still green and
only somebody's garden rearranged.

**New fields need a default, not a migration.** `mergePersisted` in
`store/persistence.ts` merges `progress` and `settings` over their defaults on
every launch, because zustand's default merge is shallow and would otherwise
hand an old blob's `settings` straight through with the new key `undefined`.
`notes` is the clean case: a blob that arrives without one takes the empty list
on the way in, and no migration step had to invent anything.

**Version 4 wipes everything written before it, and that is a licence taken once
rather than a precedent.** The standing rule in `store/persistence.ts` is that
`migrate` may never return a fresh state, because losing a garden is the one
failure here that cannot be undone. Version 4 breaks it knowingly, and what
forces it is that the ladder has nowhere to put an older garden: a sequence of
beds flattened into one bed is the sum of their sizes, and two malas come to
216, which is not a rung. Keeping such a blob would mean teaching
`nextGardenSize` about arbitrary sizes and teaching the shape rules about beds
nobody could ever have grown, for the sake of installs that do not exist — the
app has not shipped, and the You tab's Reset is already the answer for anyone
who changes their mind about the garden they do have. **The licence expires with
this version.** The next shape change goes back to migrating: by then it is a
real phone's real garden, and there is no second one of these.

What `migrate` returns for an older blob is an empty object rather than a built
state, so a fresh install is described in one place instead of two that could
disagree — `mergePersisted` runs next and lays every default down over it. A
blob from a *newer* version is passed through untouched, and the merge's own
guards are what carry a downgrade.

Guard by *shape* rather than by presence for anything the app trusts, and three
fields do it. `notes` and each session's `plants` take the default when what
arrives is not an array, because a list the app iterates must be a list.
`gardenSize` takes it when what arrives is not a number of at least one, because
the grid would otherwise be handed a lattice of `undefined` cells to draw. That
is belt and braces beside the migration rather than a second implementation of
it: the migration is what makes an old blob right, and this is what stops a blob
nobody anticipated taking the garden down with it.

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

A *note* caught during one stays, which is not an exception to that. The plant
is what finishing earned; the thought was the user's as soon as they had it. Its
link to the sitting is therefore a lookup that may never resolve, and that is
the correct outcome rather than a dangling one — see `domain/notes.ts`.

**One sitting keeps one note.** A second thought caught in the same sitting is
appended to it on a new line, never filed as a second note. That is what lets
`noteForSession` answer with a note rather than a list, and it is what makes
holding a plant give back everything you were thinking while it grew — two
cards behind one plant would be a plant that only half remembers. The join is
`sittingStartedAt`, which is the same instant for both thoughts.

## Product rules encoded in the code

| Rule | Where |
|---|---|
| One completed sitting, one choice of three; the first is planted at once and a tap swaps it | `store.recordCompletedSession`, `store.chooseOffer` |
| Length buys quantity, and past ten minutes the trade is one rare against two mids against three commons | `domain/plants.offersFor` |
| Three single commons under three minutes; the sitting that *makes* a seventh consecutive day puts a rare on the table, whatever its length | `domain/plants.ts` (`shapesFor`) |
| One bed, and it only grows — 3 · 6 · 12, then a row of twelve at a time; 108 is the mala, and the bed carries on past it | `domain/plots.nextGardenSize` |
| A garden fills in order; only the next dot answers a touch — and a full bed answers anywhere, because a full bed has no next dot | `domain/plots.ts` → `ui/PlantGrid.tsx` → `app/session/start.tsx`, `app/(tabs)/index.tsx` |
| A full bed asks to be grown and there is no size to pick; **the user confirms** | `store.growGarden`, `app/garden/grow.tsx` |
| The bed comes up out of the ground and more ground opens in it — the app's one celebration, and it celebrates the event | `ui/GrowingBed.tsx`, `app/garden/grow.tsx` |
| Whole minutes by default; seconds are opt-in | `settings.hideSeconds`, `ui/Clock.tsx` |
| Advance offered at ≥20 sessions **and** ≥21 days at stage; a decline is respected for 14 days | `domain/progression.ts` |
| The app proposes a stage; **the user confirms** | `app/session/advance.tsx` |
| The dial opens at two lengths and reaches all six by the twentieth sitting; everything on the row is tappable | `domain/stages.DURATION_UNLOCKS`, `ui/DurationDial.tsx` |
| Stage suggests a duration; it can never suggest one the dial is not yet showing | `domain/stages.ts`, `domain/progression.SESSIONS_TO_OFFER` |
| The teaching card comes before the day's first sitting only, and never before the first of all | `domain/progression.shouldShowTip` |
| Tips move forward in written order, then cycle | `domain/progression.nextTip` |
| One bell in, one out, nothing between | `session/bells.ts` |
| One daily reminder, off by default; the line rotates by the day, and none of the six mentions what you did not do | `session/reminderLines.ts` |
| A day already sat: the sun gone green, drawing and figure both, and a sleeping cat — and nothing else | `domain/stats.satToday`, `app/(tabs)/index.tsx` |
| The days are a week, four weeks and two runs; the best run is what makes the current one safe to print | `domain/stats.ts` (`weekSat`, `recentDays`, `bestStreak`), `app/streak.tsx` |
| A thought caught mid-sitting is kept, and nothing ever counts them | `domain/notes.ts`, `ui/NoteSheet.tsx` |
| One figure, pinned to a corner and not sat on a card — no label, no unit — and it is the way to the days | `ui/Indicator.tsx`, `app/(tabs)/index.tsx` |
| Theme is taste, never behaviour: it changes values, never what the app does | `settings.theme`, `theme/themes.ts` |

Wallace's criterion for advancing is the state of your mind, not attendance. The
thresholds decide only when it is *reasonable to ask*.

The offer arithmetic never rewards chopping a sitting up: three two-minute sits
come to three commons, which is exactly the most a twenty-minute sit can plant.
You cannot out-plant a long sitting by sitting badly more often — you can only
match it, and only in commons. A bundle is always one species, because two of
the same plant is a patch of something and two different plants is a shopping
list.

**The weekly milestone counts *this* sitting, and both shortcuts to it are
wrong.** `offersFor`'s `streak` is the streak the sitting *completes*, so the
seventh day of a run arrives as 7 and the rare falls on the day it is earned.
Reading the streak as of before the sitting gives six that morning and pays out
on the *eighth* day — a week of unbroken practice rewarded a day late, silently,
with the arithmetic still looking right. Adding one to that six is worse rather
than better: a second sitting on day six is preceded by a streak that already
counts today, so `+1` reads as seven and pays a day early. It is therefore
re-derived rather than adjusted — `currentStreak([...earlier, session],
session.completedAt)`, which counts a second sitting on a day as the nothing it
adds. A test pins both cases.

Each of the two derived inputs is read from the one moment that makes it mean
anything, and they are not the same moment. The streak counts this sitting,
because it is what the sitting completes. The garden's remaining room is read as
of *before* it, because counting itself would shrink the offer being made.

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
fill, the breathing ring, and the screen switcher's travelling marker. It is
four *kinds* of mark and not four screens — the wobbly button is on several now,
and it is still one place. Note which slider earns it: navigation does, because
where you are in the app is worth the app's one loud colour, while a choice made
*inside* a screen takes `Slider`'s `tone="quiet"` and a `paperDeep` marker — the
duration dial, where the choice is a length and not a place. Green means
*something grew*, and it reaches three marks: plant strokes, the sun on a day
already sat, and the stroke the days screen fills a sat day with. The sun takes
it in **both** halves, drawing and figure, which is the one place green takes a
whole mark rather than a number; it has earned that, because today something
grew.

The days screen's stroke is a licence **moved** and not a new one spent, and it
is worth saying which, because green has just left two marks and arrived at one.
The leaf that counted sittings in the garden's other corner has gone, and so has
the tally the grow screen drew a filled bed in — one bed retired both, since the
field is now the count and the grow screen draws the garden itself. A day sat is
the same sentence about a different unit, so `DayMark` strikes the tally's own
stroke rather than inventing a mark for it. Three is therefore where the count
lands from four, and it is not a ceiling that has been raised: the next mark to
ask for green is asking for a fourth.

The pen brights (`penBlue/penOrange/penPink`) have exactly two licences: a
plant's bloom (the reward-garden colour moment), and the first-run hero's night
sky (`SittingFigure`). The tally the days screen borrows its stroke from has a
fleck of the species' own bright where the plant blooms, and a day is not a
species — so that is the one part of the mark `DayMark` leaves off, and the
brights stay at two. If a pen bright shows up in ordinary chrome, that's a bug.
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
random), hand-drawn arrows (`ArrowRight` points at a row you can open;
`ArrowLeft` is the only mark this app uses for "out of here", in `BackHeader`
and on the way out of a sitting), and the `wobbly` button. The active
tab's scribble underline was the fifth and is gone: the sliding selector's
marker says "you are here" now, and an interface needs one way of saying it.
Hand-drawn check marks are sanctioned by the style but not yet drawn; nothing
beyond those is.

The pencil on the run screen is the one exception and is a **placeholder**. It
is the only icon still drawn in code, and the only one stroked — four cubics on
`PEN_DOODLE`, so it reads as the same hand at the same weight until a drawn one
comes off the art loop. When it does it joins the traced set and nothing outside
`icons.tsx` changes.

**The `wobbly` button is for committing, and that is the whole rule.** It is
Meditate; onboarding's **Begin**, being the first thing in the app you agree to;
the completion screen's **Done**, which puts a plant in the ground for good; and
the grow screen's **Grow it**, which is the largest thing this app asks anybody
to agree to. What keeps it rationed is the verb rather than a count: "Choose a
time" is a setting and "Not now" and "End" are ways out, so none of them gets
the pen. Two drawn buttons are never on screen together, and the flow is what
guarantees it rather than a rule to remember: Meditate leads to Done, Done leads
to Grow it. Since
each side's bow is a fraction of its own length they come out at different
widths — one hand at two sizes, which is why `box.ts` can stay unseeded. The
garden's next-dot ring is not a fifth kind — it is the timer's ring at another
size, which is the whole reason that geometry sits in `ring.ts` rather than in
the component that first wanted it. Every *code-drawn* path is cubic béziers
with round caps and baked-in wobble: no `Circle`, no `Rect`, no ruler-straight
lines, no perfect arcs. The icons no longer need the rule — they were drawn by
an actual hand.

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

*Which* ground is a prop rather than a constant, and that is the same rule
rather than a fourth one: the fill is whatever the drawing happens to be
standing on. `Plant`'s `ground` takes `paper` or `paperDeep` and nothing else —
the chosen offer stands on its marker, a note card's glyph stands on the card —
so a plant can never be filled with a pen.

Everywhere else `paperDeep` appears it is a *surface* rather than a drawing's
fill, which the kit has always sanctioned: the card, the note sheet, the nav
bar, the quiet slider's marker, the chosen offer's marker.

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
onboarding, the empty garden, and the foot of the field on a day already sat.
Three, and two screens with obvious room for him are deliberately left bare: the
notes, and the days. The days screen was the closer call, because a thin month
leaves real space at the foot of it — which is exactly the argument against: a
cat who turns up when the month is thin is a cat commenting on the month. A
fourth place would make him decoration rather than the cat who is where nothing
else should be.

He is always **placed, never earned**: he sits where a screen has room going
spare, and never where finishing something put him. The sat-day nap is the
nearest he comes to a reward, and it is why it has no counterpart — an absent
cat is not a reproach, and a sad one would be. He never cheers; the app's
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
*entrance* (`Sprout`, `Rise`, `Fade`) marks a first appearance; a *settle*
(`usePressSettle`) is feedback for a touch. `Rise` takes a `from`, because a
card on a page wants a nudge and the note sheet genuinely arrives from off the
bottom of the screen — one number is better than a second component. `Fade` is
its sibling for what must *not* move: a veil that slid would be a sheet of paper
laid over the screen rather than the screen going quiet, and the thing rising in
front of it is what the eye should follow. Everything animates transform and
opacity only, so every driver is native.

What belongs in that file is **vocabulary the app speaks more than once**. Two
animations deliberately live outside it: `Ripple`, and the opening in
`GrowingBed`. Each is one motion on one screen, and an entrance that can only
ever happen in a single place is not a word — putting it in `motion.tsx` would
offer every other screen a growing bed. Four things loop and all four are
named exceptions, because in each the loop is the point rather than a
transition: the breathing ring, which owns its own; `Pulse`, which breathes the
garden's next dot to the same four-in six-out count so the app has one breath
rather than two that nearly match; `Sway`, the garden's idle lean; and `Ripple`,
which is the only one of the four that ever stops for good.

**`Sway` is a whole screen that never stops moving**, which is the largest
claim any loop here makes, so it is worth saying what earns it. It reports
nothing and asks for nothing: it does not accumulate, congratulate or keep
score, it is identical whether you sat today or not, and it stops the moment you
leave the tab. A garden moves in wind — that is the entire statement, and it is
the same one the burst makes about growth. The pen's rule holds too: the lean is
half a *shear* and half a turn about the root (`SWAY_BEND`), and both have a
determinant of exactly 1 — so unlike a scale channel neither can break the rule
that a doodle changes shape and never mass.

Its arithmetic is `src/ui/sway.ts`, pure and tested on the `ring.ts` precedent,
and three things about it cost real time to rediscover.

**One clock, and each plant's whole loop stored as a sampled table.** A hundred
and eight looping drivers is not a thing to do, so `useSway` runs a single
linear 0..1 ramp and each `Sway` reads its own window out of it with
`interpolate` — the same arrangement as the burst. Everything is periodic over
one turn *by construction* (a whole number of cycles per layer), so the ramp
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

**The wind is three layers, and their rates are pairwise coprime.** One
oscillation under one gust envelope can only be a metronome — it arrives at the
same strength at the same interval forever, and the garden repeated every five
seconds visibly. Three layers at 16, 11 and 7 cycles to a turn line up again
only at the end of it, so the repeat is the whole forty seconds; any shared
factor brings them back into step early and the garden repeats inside its own
turn, silently, with every other property still holding. A test shifts each
plant's loop by a half, a third, a quarter, a fifth and an eighth of the turn
and requires it to differ from itself.

Two things follow. There is **no gust envelope** — layers drifting in and out of
phase quieten and swell on their own, and unlike a cosine they do not do it on a
schedule, which also retires the last once-per-cycle regularity. And **slower
layers are broader** (wavelengths 36, 52 and 82 cells against a garden twelve
across), so the long waves move the whole garden together while the quick one
ripples through it — which is what stops the quickest reading as a stripe.

The column and row a plant leans by are `slot % cols` and `slot / cols` in the
bed as it is cut today: the wind crosses the garden you are looking at, and a
bed six wide has six columns for it to cross. That is also the mapping the
width-freeze rule protects — a bed that changed width would move a plant into a
different gust as well as a different cell. The *seed* is still the raw slot,
because a plant's personal offset is a fact about the plant.

Coherence has to be higher with layers than without: each carries its own share
of the seeded half, so three dilute it. At the single-layer setting of 0.68,
neighbours agreed with each other only 4% more than plants at opposite ends of
the garden. At 0.88 the separation is 34%. The seed is **one per plant, shared
by every layer** — a plant's personal offset is a fact about the plant, and
three independent randoms average the wind out of the field.

`SWAY_LEAN_DEG` is a bound rather than a target: three layers rarely crest
together, so each plant's loop is normalised to peak there exactly. That keeps
the typical lean worth looking at while guaranteeing what `field.ts` sizes the
cell against.

That trade moves the cost to `SWAY_KNOTS`, which is why it is a fidelity setting
rather than a taste one — the table is straight lines between knots, and what
sets the count is the *fastest* layer. It is also a real cost: 108 tables are
built on mount, so every knot is another 216 numbers formatted into strings
before the garden can draw. 160 knots and degree strings rounded to three
decimals take that from 60ms to 27ms.

**A lean has to come out of the cell, because sideways there is nowhere else.**
`above` and `below` become padding on the grid, but the grid is *centred*, so
widening it moves nothing at all — the leftmost cell stays exactly where it was.
`field.ts` therefore divides the width by `COLUMNS + 2 * SWAY_REACH`, and the
reach is derived from the drawings (ink spans x=8.6..39.4 of the 48-unit page,
and its top stands `ROOT_Y - 5` above the root it pivots on) rather than chosen.
Every term is proportional to the cell, which is what stops "how wide is a cell
when its own margin depends on the cell" from needing to iterate.

`Pulse` is the loop that both invites and runs forever, which is the nearest
this app comes to something it does not do. The ring reports — a sitting is
running — while a pulsing dot invites, and inviting is a step towards an
engagement mechanic. What keeps it honest is that the swing is
small enough to notice only once you are already looking at the garden, and that
nothing about it accumulates, congratulates, or keeps score: miss a week and it
is doing exactly what it does now.

**`Ripple` is the fourth loop, and what earns it is that it retires.**
`src/ui/Ripple.tsx` sends one copy of the locator ring outward from the next dot
every three seconds, and only on a garden nobody has ever sat in — `PlantGrid`
takes a `hint`, the garden tab passes `sessions.length === 0`, and the first
plant in the ground ends it for the life of the app. That is the whole argument.
It cannot accumulate, it has nothing to congratulate, it keeps no score, and
there is no state it can reach in which it is asking for a second sitting: the
second sitting is the state in which it does not exist. An instruction that
deletes itself once obeyed is the opposite of an engagement mechanic, which is
what lets a *fourth* loop into a file whose first line is that almost none of it
loops.

What it is for is the one screen the app cannot explain in words. The drawn ring
picks a dot out of the lattice, which is a different job from saying what the
dot is *for*, and on a first launch nothing else on the page says it either. So
it **replaces `Pulse`** rather than running beside it: the dot already wears a
ring and already breathes, and a third motion on one mark is a mark shouting.

Three things about it are load-bearing. **One ring, never two** — overlapping
rings would keep something on that dot at every instant, and a mark that never
rests is a demand; with one, the last 900ms of every 3000ms beat has nothing on
screen at all, and that silence is the difference between breathing and
blinking. The table stopping at 0.7 of the clock is what guarantees it whatever
`RIPPLE_MS` is changed to, which is why the silence lives inside the beat rather
than beside it.
**The ring is scaled, not redrawn**, because transform and opacity are the only
things anything here animates — so its stroke thickens as it grows, which is
backwards for a ripple, and opacity is what does the thinning instead. The one
thing that has to hold is that the echo never out-inks the mark it came off, or
the dot has two rings and no centre. Ink goes as rendered width times opacity:
the locator's is 1.6 × 1 = 1.6, the echo leaves at 1.85 × 0.55 = 1.02, about two
thirds of it, and is last visible at 4.14 × 0.035 = 0.15. The stroke more than
doubles across the life while the ink falls by seven, so by the point the line
is two and a half times the mark it came off there is under a tenth of its ink
left to look fat with. And **how far it travels is tuned against the
neighbouring dot's blob** — `RIPPLE_SCALE` is 3 with a ceiling of 3.07, and the
margin is thin enough that widening `RIPPLE_WIDTH` or `SCATTER` eats it. The
arithmetic is written out in the file; what matters here is that the bound is
the neighbour's ink and nothing nearer.

That last one replaced a derivation, and the derivation was the elegant answer
to the wrong question. The travel used to be `LOCATOR.reach / LOCATOR.radius` —
the edge of the dot's own canvas, which `ART_SHARE` makes exactly half a cell,
so the echo provably stayed inside the cell it started in. But staying inside
its own cell is not something the echo owes anybody: it only ever runs on a
garden with no sittings in it, so every cell it crosses holds paper and one
faint blob, and the blob is nearly twice as far away as the canvas edge. The
bound was a third stricter than the constraint, and that is what was keeping the
mark small.

**It was first tuned quiet, from screenshots, and that was the wrong direction
to tune from.** A browser is honest about proportion and overstates *amount*, so
a mark that looks sufficient there arrives on glass smaller and lighter than it
looked; the first pass was simply not noticed on a phone, which for the one mark
whose whole job is to be noticed is total failure. Hence three seconds rather
than 3.6 — a mark nobody has seen gets its chances one beat at a time — a peak
of 0.55 rather than half that, and half again the travel. Judge amount
conservatively upward from a browser and settle it in the hand.

Its loop **wraps an `Animated.sequence`**, and that is not a style choice — see
the frozen-loop trap below.

**The field is twelve across at its widest, so 108 lands on nine rows and a mala
fits one screen.** It used to be six across, where a cell was 60pt wide and a
dot was a 5.5pt blob adrift in it, and the plot ran two and a half screens deep. Dense,
the dots read as one texture the grown marks sit in rather than as a list of
buttons — which is what the garden is for. Two costs, both accepted: the tap
target is a 30pt cell rather than a 60pt one, and `field.ts` floors
the cell to a half point and draws the grid at exactly twelve of them, because
twelve fractional widths can total a hair over a fractional container and throw
the last cell onto a row of its own.

**Twelve is not how wide the bed always is — `shapeFor` cuts each size its own
bed.** Two bands, and the line between them is the load-bearing part. A bed of
twelve dots or fewer is a single row of exactly that many: three in a row is a
bed, three in a square is a mistake. From thirteen up it is twelve across and as
many rows as it takes. That is the width-freeze rule seen from the drawing's
side — below the fold `cols` *is* the size and the row is always 0, so the
mapping does not depend on the width at all, which is exactly why the ladder is
allowed to widen the bed there and nowhere else.

The **pitch is constant at every width**: `field` measures the cell against
`COLUMNS` whatever the garden, then draws the lattice at `cell * cols`, centred
in the room it was given rather than stretched to fill it. A narrower bed is a
narrower bed and never a coarser one, which is what lets a 6 sitting beside a 12
be *seen* to be half of it. A last row may come up short, but every rung above
twelve divides exactly, so only a size off the ladder could do it and nothing
writes one.

`GrowingBed` is the one place that pitch is deliberately not held, and what it
keeps instead is the arithmetic. The grow screen draws one bed with nothing to
compare it against, so a starter bed at the garden's pitch would be a postage
stamp in the middle of a phone; the room is spent there rather than the
comparison, by asking `field` for the cell at which the bed's own `cols` fill
the width. That is the inverse of the question the garden asks it, and it is
answered by handing the same function a box wider than the screen so only the
empty margin hangs over — an inversion rather than a second formula, which is
what stops the two from drifting. From twelve dots up the two widths are the
same number anyway, so this only ever shows itself on the first two rungs.

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

**`dotOpacity` is the only thing allowed to vary how a dot is drawn, and exactly
one screen passes it.** Every empty cell is otherwise `inkFaint`, the faintest
the palette goes — the dots ahead of you are a promise, and drawing them weaker
would make the promise the hardest thing on the screen to see. The prop exists
for the one screen with ground that is *offered* rather than had, and what makes
it safe is that it reaches empty cells only: a plant is a record of something
that happened, and no caller gets to draw it a shade less true than it was. It
takes an `Animated.Value` as well as a number, so the inking can be watched
rather than switched, and leaving it off builds no wrapper at all — the tab that
draws a hundred and eight empty dots pays nothing for a prop it never passes.

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
and needs no change to the drawing. The two are one thing in the code as well:
`PlantGrid`'s `onBegin` is optional, and a grid drawn without a way to start a
sitting has no ring rather than a ring that is suppressed separately. The ring
marks where you would carry on, so a garden you cannot carry on from has nothing
for it to mark.

Linear planting also quietly fixed an overlap. A plant's head stands about
12.5pt above its own cell, so a plant in the row
*below* an empty dot used to reach up over that dot's ring, and `zIndex: 1` meant
the ring won and looked wrong. That case is a hole with a plant after it, which
only free planting could make. Filling in order, everything past the next dot is
empty, so nothing is ever drawn over it — and since version 4 reads no older
blob forward, there is no garden left anywhere carrying a hole from before.

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

**One sliding selector, used twice.** `src/ui/Slider.tsx` owns where the
marker is and how it travels; the caller owns what each item draws and what the
row sits in. The screen switcher (`SliderNav`) floats in a bar over the page and
is the only one that earns the accent; the duration picker floats on bare paper
and takes `tone="quiet"`, because a length is a choice made *inside* a
screen. Items are a fixed width by contract, which is
what keeps the travel to a single `translateX` and therefore on the native
driver — and means there is nothing to measure and no frame where the marker is
in the wrong place. It is silent: the kit allows this one navigation a sound,
but this app rings one bell in, one out, and nothing between.

**The duration dial has no container.** A few numbers with air between them are
already legible as a row of choices; the card that used to hold them was a box
drawn around something that did not need one, and the heaviest mark at the foot
of a screen whose whole argument is that it is quiet. Small boxes with generous
gaps (38 × 36, gap 10) rather than large boxes packed together — both fit the
same width, only the second breathes, and the marker then reads as having
arrived somewhere rather than as one cell of a strip. Selection is carried twice
over, by the soft marker and by the number darkening from `inkSoft` to `ink`;
what the unselected ones must never do is fade, because everything on the row
can be had and a greyed-out number would say otherwise.

**The row grows over the first twenty sittings, and that is a tutorial rather
than a gate.** `DURATION_UNLOCKS` opens at two and three, adds five at the third
sitting, ten at the seventh, fifteen at the twelfth and the ghatika at the
twentieth. A first-time sitter has no idea what twenty-four minutes feels like,
so six lengths on the first launch is a choice handed to somebody with nothing
to make it with — and the one they are likeliest to try out of curiosity is the
one Wallace says they will fail at.

A locked length is **absent from the row, never drawn and greyed out**, which is
what keeps the paragraph above true. And the mechanism retires itself by
arithmetic rather than by care: the ladder is fully resolved at twenty sittings
and every route out of stage one runs through at least `SESSIONS_TO_OFFER`
sittings at stage one, so there is no reachable state in which a stage proposes
a length the dial is not showing. A test pins exactly that, which is why
`stages.test.ts` imports from `progression.ts` — the two constants are one fact.

The chosen length is printed nowhere else. A large figure above the button said
exactly what the dial's own marker says, in a place you cannot change it.

**The completion screen borrows that language and not the control.** Three
offers sit on bare paper for the dial's reason, and selection is carried twice
over again — a `paperDeep` organic-corner marker, and the chosen plants standing
6% out of the row — while the unchosen ones never fade, because every offer is
available. What it cannot borrow is `Slider`, whose contract is a fixed item
width: one, two and three plants are three widths, so the marker is per offer
and arrives in place rather than sliding.

`src/ui/offerRow.ts` is that row's arithmetic, pure on the `field.ts`
precedent, and two things in it are worth knowing. Each box **hugs its own
ink** — a poppy stands nearly twice as high above its root as a grass, and one
box drawn to the tallest would put a slab behind a short offer. The reach is
measured off the paths (`Plant.tsx`'s `inkOf`), the way `isShape` reads the
fills, so a redrawn plant cannot silently get it wrong; `field.ts`'s `Ink` is
the *bound* over all twelve, which is right for a lattice laid out before anyone
knows what lands in it and wrong for three named species standing together. And
a bundle shrinks by `1/√count`, holding its total ink *area* to a single
plant's — a bundle is the same amount of drawing rearranged, not three times as
much of it, and an offer drawn bigger would be an offer being recommended.

**The garden tab carries no copy at all, and the bed is the whole of the
figure.** It had a title and a caption and both are struck: "Your garden" named
the screen you were already standing on, and "so many of so many" put a number
beside a drawing of the same number. What is left is the field, the sun in the
corner, and the cat — nothing on the page that has to be read. Nowhere in the
app is there a percentage, a pace or a projection.

Losing the caption cost a route, because it was the only manual way to the grow
screen. So on a **full** bed the plot itself answers a touch
(`accessibilityLabel="Grow the garden"`), and only then. That is not a second
target beside the ring: a full bed has no next dot, so there is no ring to
compete with, and the two states exclude each other by construction rather than
by care. The rule that only the next dot answers a touch is intact — a bed with
room in it is untouchable everywhere else, and the wrapper is gone the moment
there is room again.

It has to exist because of a corner that is rare and permanent. Finishing a
sitting normally lands on the completion screen, whose **Done** goes to the grow
screen on its own; killing the app there instead leaves a full field, no ring,
and nothing to press. A line of copy would be the app explaining itself, and an
automatic redirect would fight the back gesture and could loop somebody who only
wanted to look at their garden. The cost is real and is accepted: while the
wrapper is up a screen reader sees one button rather than the plants inside it,
so holding a plant to read its note is out of reach until the bed grows. That is
the right way round — the notes have their own screen, and this is the only
state in the app you cannot otherwise leave.

**The grow screen is the app's one celebration, and what it celebrates is the
event.** This is where the no-congratulation rule is spent rather than broken,
and the line between those is the second person. The copy is **"The bed is
full."** — four words about the bed — and there is no adjective about you
anywhere on the screen; nothing counts you and nothing says you did well. The
motion is the congratulation, and the motion is a statement of fact: the bed
comes up out of the ground, and then more ground opens in it. Any future
celebration is measured against that sentence, not against this screen.

What it draws is the **real garden**, `PlantGrid` at `nextGardenSize`, and that
is an argument rather than reuse. The screen's claim is "this is the garden you
are about to have", and a drawing of its own would be an artist's impression of
one — a different pitch, a different scatter, marks that are not the marks —
and it would drift the first time a plant was redrawn. There is no size at
which an abstraction would earn its place here either, which is what retired the
tally this screen used to fall back to past six plants: a mala is nine rows at
the garden's own pitch, and nine rows is a quarter of a phone. Laying the plot out
one rung up from the moment the screen opens is also what makes the offer
legible without
a second number: a bed that has filled has no holes in it, so *every* empty dot
in that plot is exactly the new room, and nothing has to be told which dots are
the offer. That matters because the ladder took the choice of size away — any
other size would re-flow plants already in the ground — and it must not take the
knowing with it. "Grow it" says nothing about how much; the ghosts do.

`src/ui/GrowingBed.tsx` is how that is drawn, and it is **one grid rather than a
composite**. `dotOpacity` is the whole of what this screen needed: the plot
already says which dots are the offer, so the ghosts want no second drawing, no
second lattice, and nothing held in step with anything. That the prop dims empty
cells and only empty cells is what lets the offer and the plants share one grid
in the first place — see it beside `PlantGrid` above.

The grid then slides as one drawing, and that is what makes both growths one
motion written once. What you watch is the plants leaving the middle while the
ground they are making way for inks in behind them: the bed is not being added
to at one end, it is being **re-centred** on a bigger bed, which is exactly what
a centred lattice does when it gains a column or a row.

**Which way it grows is `shapeFor`'s answer and not this screen's.** At 3→6 and
6→12 the bed is still one row, so it widens and the plants slide outward — the
bed moving rather than the plants, which is the motion a phone being turned
makes. From twelve on the width is frozen and a whole row arrives below, so the
same slide runs vertically instead. Which axis is the only thing that differs
between the two, and both readings come out of `shapeFor` because that is the
function deciding how either bed is actually laid out; anything else would be a
second opinion about a shape.

**The new dots do not sprout.** Ground does not sprout; it fades and settles, on
`Easing.out` with no overshoot, because an overshoot on a slab of earth reads as
elastic and an overshoot on opacity is a flicker. `GHOST` is two thirds, and it
was measured rather than judged by eye: at seven tenths the firming could not be
found between two screenshots taken either side of the press, and much below it
the dots go back to being the hint this was corrected away from. At two thirds
the dot's ink runs from a fifth of the paper's range to a third — half as much
ink again, arriving across a whole row at once, which the eye catches in motion
far more readily than a still comparison suggests. Nothing on the screen loops,
which is deliberate on the loudest thing the app does: a celebration you can sit
and watch repeat is a screen asking to be stayed on.

**The bed sits high on the page rather than centred in it.** Centred, it
floated — a band of garden with paper above and paper below, adrift between a
back arrow and a button, and reading as the smallest thing on a screen it is
meant to be the subject of. Put at the top with its caption under it, the
picture is what the screen opens with and all the paper collects in one place,
above **Grow it**, which is where this app keeps its slack everywhere else.

Pressing **Grow it** holds the screen for `GROUND_FIRM_MS` and for that alone.
The extension is the *offer*, so it has already played; what the press adds is
the ghosts becoming ground, and leaving on the tap would make that invisible and
turn them into a promise the app does not keep. A second touch was the other
candidate and is wrong for a reason that is not about pacing — the drawn button
is what commits, there is only ever one of it on a screen, and a screen that
asked you to agree and then asked you to leave would be two commitments. The
store is written at the end of that wait rather than at the tap, so nothing the
screen is showing can be contradicted while it is showing it: the bed is derived
from `gardenSize`, and growing it mid-screen would step the ladder a second time
under the finger that pressed it.

**"Your days" is the other half of the question, and the garden cannot answer
it.** The bed fills in order and says nothing about the calendar, so a hundred
sittings over a year and a hundred over a fortnight fill the same bed to the
same dot. `app/streak.tsx` is where time is the subject: a Monday-first week
with weekday letters, the two runs, four weeks of texture, and the totals. No
plant appears on it.

It is a stack screen and not a third tab — tabs are rationed, there is no Sit
tab either, and one more would need a hand-traced mark off `npm run art`, which
is a hardware loop rather than a code change. It is also the right shape for the
thing: you come, you look, you leave. The route in is **the sun**, because a
streak is the one number on the garden tab that is about the calendar rather
than the bed, so the mark reporting it is the mark that opens the screen it came
from and nothing new is added to the page to say so. The You tab's **Days** card
is the second way in, and it is reachable at nought exactly as the notes are:
"you have not sat yet" is a fact about the screen rather than a reason to hide
it.

**Three rules govern every mark on it.** Nothing on it mentions a day you did
not sit — an unsat day is the same faint dot the garden puts under every slot
nobody has reached, which is a day with nothing in it and not a day you failed
at. Nothing on it is a percentage, a pace or a projection; every number is a
count of something that happened. And **`bestStreak` is what makes the screen
safe to build at all.** A current run is a number that spends most of its life
going down, and a large figure reading nought the morning after a missed day is
the app telling you that you failed. Kept beside the best, a broken run becomes
a run that *ended*: the days are still there, the app still knows about them,
and nothing has gone to zero and stayed there. The totals at the foot are the
monotone counterweight under both — a sitting that happened cannot be undone by
a thin week — and they are set quietly in `inkSoft` because that is the whole of
their job. They are not the news; they are what stops the news being the only
thing on the page.

CURRENT and BEST are `label` over `stat`, which is the pairing those two
variants were cut for and had been waiting on: `stat` had no caller at all until
this screen, and `label` had plenty but never one standing over a figure.
Neither figure is green — green means something grew, and a streak is an
arithmetic fact about days rather than a thing that grew.

**`DayMark` borrows the garden's marks rather than inventing a second
vocabulary**, because both are saying one sentence about different units — two
sittings on a Tuesday are two plants and one Tuesday. An unsat day is
`EmptySlot` itself, ring and all, so the locator that says "this is where the
garden carries on" says "today is still open" standing in a row of days, with no
copy at all; reusing the component rather than the idea is what stops a nudge to
the ring's tilt leaving this screen circling at the old one. A sat day is the
tally's stroke — redrawn on the dot's own canvas rather than lifted, because two
marks on two canvases at one `size` come out two sizes, and struck *centred*
rather than on a ground line, because what it shares a row with is a blob whose
ink is the middle of that canvas. The garden's lesson about a shared ground line
does not transfer: there the two marks differ by two thirds of a cell, here by
nothing.

The week and the window are `weekSat` and `recentDays`, siblings rather than one
written in terms of the other. A week is a thing with names — it begins on
Monday whatever today is, so its edges are the calendar's and not yours — and a
window has no names and no edges, being four weeks that always end where you are
standing. Both are seven across so the columns line up under each other, and the
window is dealt into explicit rows rather than wrapped for `field.ts`'s reason:
seven fractional widths can total a hair over their container and throw the last
mark onto a row of its own.

Its motion is entrances only and adds no loop. Every mark sprouts off the
garden's own `useBurst`, restarted from a plain `useEffect` because a stack
screen's mount really is an arrival, and the figures and totals stagger in on
`Rise`. The empty days sprout too, which the garden does not do — there the dots
are the ground the plants come up out of, and here nothing is ground: a day with
nothing in it is one of the seven things being drawn. Delays are seeded off each
mark's key and **scrambled** before the modulo, which is `hash32`'s standing
rule for anything slicing bits out of a key whose last character varies; the
garden skips the scramble only because its start times are frozen and must keep
answering the same forever.

The clock is read once, on arrival. Every mark is placed against a day, so they
all have to agree about which day it is, and reading `Date.now()` per call would
let a midnight fall between the week row and the window under it.

**The notes screen is a two-column masonry, estimated rather than measured.**
`src/ui/masonry.ts` deals each card into whichever column has least, weighing it
by how many lines of body it shows and clamping at what the card actually draws.
Measuring for real would cost a frame with the cards in the wrong places, and a
pile of notes has to look evenly packed rather than be provably optimal. Nothing
lines up across the columns, which is the point: the eye takes them one at a
time instead of reading down a list. There is no search, no tag and no folder —
a note is kept so that it could be let go of, and filing them would be the
opposite of that.

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

Consequence, and it is **Android-only**: in Expo Go on Android the daily
reminder and the backgrounded-session notification silently no-op, so a
development build is the only place the reminder — rotation included — can be
tried on that platform.

**Expo Go on iOS is not affected**, and that asymmetry is deliberate rather than
luck. The throw lives in `expo-notifications/build/warnOfExpoGoPushUsage.js` and
is gated on `Platform.OS === 'android'`; on iOS it degrades to a `console.warn`.
`UNSUPPORTED` is written to match — `(IN_EXPO_GO && Platform.OS === 'android') ||
Platform.OS === 'web'` — so iOS Expo Go requires the module and schedules real
local notifications. What makes that safe is that nothing here ever asks for a
push token: `getExpoPushTokenAsync` and `getDevicePushTokenAsync` are the only
callers of that guard, and neither appears anywhere in `app/` or `src/`. Traced
through the installed module rather than watched on a handset — confirm on a
phone before trusting it.

**A `DAILY` trigger freezes its content** at the moment it is scheduled, so a
reminder set once would read out the same sentence every morning for a year —
which is exactly what the six rotating lines exist to avoid. The only fix is to
schedule it again, and `useReminderRotation` does that from the root layout on
mount and on every return to the foreground; `reminderBody` picks by the local
day, so a reschedule is a no-op on a day already scheduled for and a new line on
any other. The limit that leaves is real rather than a bug: the line you get is
the one chosen the last time you *opened* the app, not the one for the morning
it arrives. Go a fortnight without opening it and you get a fortnight of the
same sentence — the right trade, since the alternative is an app queueing up
fourteen separate chances to nag you. The rotation never cancels; turning the
reminder off stays with the screen that also has to ask permission.

**An absolutely positioned child is inset by its parent's padding on a phone and
not in a browser.** Yoga and CSS disagree about which box an absolute child is
placed against, so anything measured off a padded container lands in two
different places on the two targets this app is judged on — and `Screen` pads
every screen. The run screen's pencil is therefore laid out in a *row* beside
`End` and positioned only within that row. This is a constraint and not a
styling preference: the web preview is where layout is decided, and a layout
that only agrees with itself there is worse than no preview.

**Fonts ship as Latin subsets in `assets/fonts/`, not from npm.** M PLUS
Rounded 1c carries CJK coverage — the full face is ~3.3MB *per weight*, so three
weights would put ~10MB of font binary behind the splash to set English text.
`scripts/subset-fonts.sh` (needs `uv`; fetches `pyftsubset` ephemerally) subsets
the TTFs from the `@expo-google-fonts` packages, which stay in devDependencies
only as the regeneration source. Re-run it after bumping them; add `U+0400-04FF`
to its ranges if the app ever grows Cyrillic text. The earlier lesson still
stands underneath: never import an `@expo-google-fonts` package by its root —
the root `require`s every weight.

That subset is also why `src/ui/time.ts` pins `toLocaleDateString` to `'en'`.
Every string in this app is English, so a month name taken from the phone's
locale would not merely read oddly under a note headed "Note" — on a Russian
handset it would come back as tofu, and only on that handset.

**A `transformOrigin` must be an array, never a string, if it is not a whole
percent.** React Native parses a string origin with
`/(top|bottom|left|right|center|\d+(?:%|px)|0)/g` — integer digits, no decimal
point. `'50% 89.58333333333334%'` therefore does not fail; it matches
`58333333333334%` out of the middle and pivots the view fifty-eight trillion
percent down its own height, which throws it past the horizon. `ROOT_SHARE` is
43/48, so every plant animation lands on exactly this. The array form skips that
parser: `src/ui/field.ts`'s `ROOT_ORIGIN`, which `Sprout` and `Sway` both use,
and `OfferMark`'s, which is the same trap in points rather than percentages —
any origin that is not a whole percent has to be written as an array.

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
The dev panel's Reset clears `sessions`, `notes`, `progress` and `settings` back
to their initials, and `onboardedAt: null` is what redirects to onboarding — so
a wiped garden after pressing it is the button working, not hydration failing.
Check that before going looking for a persistence bug.

What happens on a cold launch is pinned by
`src/store/__tests__/hydration.test.ts`, which boots the store against real
version-1, -2 and -3 blobs and asserts each comes back with nothing in the
ground, on the starter bed, on onboarding, and with no field of the old shape
left behind — the stage, the tips and the settings go with the garden, because a
blob half carried forward is worse than either outcome. A version-4 garden comes
back untouched in the same suite: every plant in the dot it was planted in, the
bed it was grown to, planting carrying on where it left off, and a notebook that
round-trips. If that suite is green, hydration is not your problem.

## Where the docs live

`README.md` is a landing page: a slogan, the pictures, and the two quick starts.
Everything reference-shaped — the commands, the Expo Go caveat, the product
table, the tree, the dev panel — lives in `docs/GUIDE.md`, and the README links
its anchor. Depth goes to the guide; this file stays the spec.

Its images are in `docs/images/`, captured off `npm run web` with the
`craft-readme` skill. Reshoot rather than hand-edit them.

The garden's burst is an **APNG and not a GIF**, which is not a preference. A
GIF has 256 colours, and this app spends most of them on the anti-aliasing of
one green pen over cream paper — quantised, the pink blooms came back orange and
every stroke dithered. Full colour costs about 2.5MB against a GIF's 1.5MB, and
GitHub animates both from a repo path.

## Parked ideas

`TO-DOS.md` holds ideas that were raised and deliberately not built, with what
makes each one awkward written down beside it — the constraint is usually the
interesting part and the expensive thing to rediscover.

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

The seventh mark, the run screen's **pencil**, has not been through that loop —
it is stroked in code on `PEN_DOODLE`. When a drawn one comes off `npm run art`
it becomes another `Mark`, and nothing outside `icons.tsx` changes.

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
that stays a one-file change, and everything else a species is asked about is
*measured off the paths* rather than written down beside them — which shapes are
filled (`isShape`), how far the ink reaches (`inkOf`), what it blooms in
(`bloomOf`). A re-trace therefore cannot leave a stale second list behind.
`SittingFigure` and `Baton` follow the pen contract and come from the Karakuli
kit's hand.

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

**A release build's data cannot be reached over adb.** `run-as` answers
`package not debuggable` — Expo signs the release variant with the debug
keystore, which is what lets it reinstall over itself, but it is not
`android:debuggable`. So there is no editing the stored blob in place and no
pulling it off to look at: `adb shell pm clear com.justsit.app` wipes the garden
and is the only lever. A garden that needs *changing* rather than clearing needs
a migration in the app. Clearing also resets `onboardedAt`, so the app comes back
on the onboarding screen — that is the clear working, not a hydration bug.

`android/` is generated by prebuild and gitignored — `app.json` is the source of
truth, so never hand-edit the native project. `android.package` is
`com.justsit.app`, which is *not* Expo Go's package: the two have separate
storage, and a garden grown in one is invisible to the other.

The **You tab has a developer panel** (seed sessions, jump stages, arm the
advance offer, reset). Use it — the interesting states of this app are the slow
ones, and waiting three weeks for a stage offer is not a test strategy. Seeding
runs past the end of the bed, which no real sitting can: the app stops and asks
whether to grow it, and there is nobody there to answer, so the panel steps the
ladder itself, a rung at a time — the same rungs the grow screen would have
taken, so a seeded garden is a shape the app could actually have arrived at. One
plant per seeded sitting, in the first free dot — the shape a ten-minute sitting
takes when its single-plant offer is accepted. `+3` fills the starter bed
exactly, which puts the grow screen one tap away, and `+108` is a mala's worth
in one press.

**It is behind `__DEV__` *or* `settings.devMode`, and the second gate is the
one that matters here.** Everything this section is about — both notification
paths, the hidden status bar — needs a release APK, where `__DEV__` is false by
construction and the panel used to simply not exist. So it is a stored setting
too, turned on from a "Developer" card at the foot of the You tab, and the
consequence is that the panel now ships: it is no longer folded out of a release
build by a constant Metro can see through. `__reset` takes `devMode` with it,
being one of the settings a fresh install does not have, so the panel's own
Reset puts the panel away on a phone; the card is still there to turn it back
on.

**With the mode on, a sitting's clock runs five seconds and is recorded at the
length that was chosen.** That split is the whole point and it is one line in
`src/session/devClock.ts`: `useSession` is handed the short clock and derives
from wall time exactly as always, while `recordCompletedSession` is handed the
chosen duration, so the bell, the completion screen, a long sitting's trio of
offers and the stage it might propose all arrive after five seconds and all
behave as they would after twenty minutes. A sitting that filed itself as five
seconds would grow three commons and nothing that depends on length could be
tried at all. The clock counts the five seconds honestly — 0:05 with seconds
shown, and a flat "1" with them hidden, which is the rounding the app already
does. The panel says the mode is on for the same reason, because a shortened
sitting is the one shortcut that changes what the app *does* rather than what is
in it.

### iOS

**No iOS build can be produced or run on this machine, and the ceiling is the
hardware rather than the setup.** SDK 57 wants Xcode 26.4+ and an iOS 16.4
deployment target. This is a `MacBookPro11,5` — Mid-2015 Intel — whose last
supported macOS is Monterey 12 and therefore whose last supported Xcode is 14.2.
The only simulator runtime installed is iOS 16.2, *below* the deployment target,
so even an `.app` built elsewhere could not be launched here. There is no
CocoaPods and Ruby is 2.6. Don't attack this again: QEMU is no way round it
either, because the iOS Simulator is not an emulator — it runs host-ABI binaries
against reimplemented frameworks on macOS — and emulating real iOS needs code
signing and has no GPU.

What does work is **Expo Go on a physical iPhone**, which needs no native build,
no Apple Developer account and no change to the repo:

```sh
npx expo export --platform ios     # bundle-only pre-flight, no phone needed
npm start                          # then enter the LAN exp:// URL in Expo Go
```

`expo export` is the cheap half of that loop and worth running first: it
compiles the whole iOS bundle, so an iOS-only resolution failure surfaces as a
bundling error rather than as a red screen on a handset. It passes — 1394
modules, the first time this codebase had ever been bundled for iOS.

Two things Expo Go cannot answer on iOS, both for the reason it cannot on
Android: the `hidden: true` status-bar *plugin* config needs a real build (the
`<StatusBar hidden />` component still works), and the app runs under Expo Go's
bundle identifier rather than its own.

If a native build is ever genuinely needed, the route is an **EAS cloud
simulator build** — `ios.simulator` in `eas.json`, which needs neither an Apple
Developer account nor code signing — run on a Mac new enough for Xcode 26, or
streamed through Appetize. That route needs `ios.bundleIdentifier` set in
`app.json` first: it is absent today, and `expo prebuild` would otherwise write
a guess into the file rather than ask.

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
- **The garden's sway does not animate on web at all** — the browser draws a
  frozen field and gives no hint that it is frozen. `Animated.loop` on a bare
  `timing` takes the `_startNativeLoop` path, which no-ops when the native
  animated module is missing; `Pulse` and `Ripple` both wrap a `sequence`, which
  has no such path and falls back to the JS loop, so the next-dot ring breathes
  and ripples there and nothing else moves — which is also why any new loop here
  is written as a sequence whether or not it needs the steps. A single screenshot
  looks perfectly correct, which is the trap: it cost a whole round of diagnosis
  to notice the difference between a still frame and a still garden. Judge the sway on a device, or in `anim-lab.html`, which
  runs its own RAF loop and is unaffected.
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
a CSS easing. The pivot is the plant's **root**, 43 of its 48-unit page, not the
bottom of its canvas a nib's margin lower. And the start times come from the
same `hash32`, so a slot sprouts when it would sprout in the app. Change any of those and the bench is a nice animation
of something else. The `.scroll` box clips like the real ScrollView too, so the
top row's overhang is judged honestly rather than hidden.

What it does *not* reproduce: which species grows where. The app resolves that
from a session id at completion; the bench hashes it off the slot, so the field
is varied and stable but is nobody's real garden. As with the web preview,
decide here and confirm on the phone.

> **The Sway tab lags the app and cannot be trusted for the sway's shape.** It
> still models one oscillation under a cosine gust, which is what the app did
> until the wind became three coprime layers with no envelope. Its lean, bend,
> knots and coherence still mean what they say; its `sways/cycle` and `gust` no
> longer exist in `sway.ts`. Bringing it across is the next job on this file.

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
a squashed plant swings as wide as a full one. And the lean is half a **shear**
and half a turn about the root (`bend`, 0.5 in both), each of determinant
exactly 1 — so unlike a scale channel neither can break the rule that a doodle
changes shape and never mass. Everything is periodic over one
turn of the clock by construction — in the bench a whole number of sways under
one gust, in the app a whole number of cycles per layer — so the loop closes
without a seam rather than being checked for one.

**The phase is scrambled before use, and neither end of `hash32` will do on its
own.** FNV-1a ends on `h = (h ^ c) * prime`, so two keys whose last character
differs by one come out differing by about `prime`. The top bits ramp — take
them and the whole field drifts in step. The low bits were the first fix and
were just as wrong: they are an arithmetic progression of `prime mod 2^k`, which
for twelve bits is exactly 403/4096 per slot, so consecutive plants came out 35°
apart in phase, every time, in reading order — a travelling wave wearing a
seed's clothes. A uniformity histogram cannot catch that, because a ramp is
perfectly uniform. Murmur3's finalizer is what fixes it, and it lives in
`domain/hash.ts` as `scramble` rather than in the one file that learned it
first: everything slicing bits out of a key runs it now — the sway's phases, the
species drawn for an offer, the reminder's line of the day. `hash32` itself
stays frozen, since the garden's scatter and the burst's start times depend on
it answering the same forever.

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

## Seeing the wind: the field demo

`tools/field-demo.html` is a huge perspective field of grass in the app's hand,
with the app's wind blowing across it. Open it straight off disk — no server, no
build step, no network.

```sh
open tools/field-demo.html
python3 tools/lab-data.py    # re-lift the drawings after redrawing one
```

It exists because **the garden is too small to show its own wind.** `sway.ts`
blows three travelling waves over the field, and the shortest of them has a
wavelength of 36 cells against a garden twelve across — so at the app's size the
whole plot leans more or less together and the layered model has never been
visible. Give it a hundred columns of world and you watch crests cross the
field, quieten as the layers drift out of phase, and swell again. It is the only
place that model can be judged rather than trusted.

It is a **copy**, the `anim-lab.html` precedent, and `lab-data.py` now patches
both pages' `const DATA = …;` line — add a page to its `TARGETS` when it needs
the app's drawings. Two things it deliberately does not take from `src/`:

**The grid arithmetic.** `COLUMNS`, `PLANT_ZOOM`, `ART_SHARE`, `SCATTER`,
`GROUND`, `SWAY_REACH` and `field()` all answer "how do I fit a twelve-column
lattice into a phone's width", which is not a question a field asks. Plants are
placed by perspective projection: `near` is *derived* so the closest row stands
on the bottom edge of the window, which is what lets one set of numbers hold at
any window shape. What it does take is the part that is about the drawings —
`CANVAS`, `ROOT_Y`, the pen, `isShape`, and the palettes.

**The knot table.** `SWAY_KNOTS` exists because `Animated.interpolate` needs a
table to stay on the native driver. Canvas has no such constraint, so the demo
evaluates `layerAt` directly every frame — cheaper than the tables at a few
thousand plants, with no startup cost and no piecewise-linear corners at all.
The one thing kept per plant is the normalising scale, since finding a loop's
peak still means sampling it once.

It renders to **one canvas with `Path2D` per species**, not to DOM nodes.
`anim-lab.html` gives each plant a `<div><svg>` and writes `style.transform` at
it, which is right for 108 cells and hopeless for a few thousand: every write
invalidates an SVG subtree. At the shipped density it is ~3,500 plants at about
8ms a frame.

**The ground is not flat**, and it costs almost nothing that it isn't. Height
enters the same term the camera does — a point standing `h` up is seen from
`EYE_H - h` — so terrain is one subtraction in the projection and no change at
all to scale, sorting or the wind. Painting still sorts by depth rather than by
screen position, which is what makes a near ridge cover the dip behind it even
though the dip sits lower in the frame. Two things had to be right: the relief
is damped to nothing at the camera, since you are standing on this ground and a
crest rising between the eye and the bottom of the window would leave a bald
strip of paper along the bottom edge; and the wavelengths are set against how
much world is actually in frame. At fifty metres they were wider than the
visible field at every depth, so the ground tilted as one piece and read as
flat — about twenty-five metres is where a swell starts looking like a swell.

**Frame cost is paid per device pixel, which is why it measured fine and felt
slow.** The same window on a retina display is four times the work. Three
changes took it from 18.3ms to 7.9ms at the same plant count on the same
emulated 2× display:

- **The backing store is capped at 1.5×, not 2×.** On soft round strokes over
  warm paper the difference is not findable, and it is 44% of the fill. Of
  everything here, sharpness is what this page can most afford to spend.
- **The Möbius warp is a table.** The frame loop wants it three times per plant,
  and `atan2` wrapped in two `sin` and a `cos` was tens of thousands of
  transcendentals a frame for a curve that is the same shape every time. The
  table is built by *calling* the copied `layerAt`, never by writing the
  expression out twice, so the two cannot drift; 2048 steps leaves an error near
  a millionth of a degree on a thirteen-degree lean. This is **not** the app's
  `SWAY_KNOTS` — that samples each plant's own summed loop and its count is a
  fidelity setting, while this samples the one shared waveform underneath all of
  them, where the count is free.
- **One `setTransform` instead of seven calls.** The composite is multiplied out
  in JS. Worth it only because it is per plant per frame; the comment carries
  the seven calls it stands for, because that form is the readable one.

And it **governs itself**, because no fixed density is right on two machines.
A run of frames over budget gives up resolution first and only then thins the
grass — resolution being the one that does not change what is on screen. It
steps down only, after a run rather than a spike, so it settles instead of
hunting. `__field.quality()` in the console says where it landed.

Two traps in measuring this, both of which cost time: headless Chromium throttles
`requestAnimationFrame` to about 3fps, so a governor keyed on consecutive slow
frames will never trigger there however slow the page is; and driving `draw()` in
a synchronous loop instead reports ~200ms a frame, because canvas work cannot
pipeline with the GPU that way. The honest measurement is `stats.ms` sampled
under real rAF, and even that is software rasterisation. Compare runs against
each other, never against an absolute target.

Three findings there cost real time and are worth keeping:

**Slicing `hash32` without scrambling banded the field.** The column index is the
last character of the key, and `hash32`'s last act is `h = (h ^ c) * prime`, so
consecutive columns come out a fixed distance apart — a ramp in the top bits, an
arithmetic progression in the bottom. Species picked off the raw word swept
along each row instead of scattering, and the field came back with runs of
tulips lying in stripes. `sway.ts` already documents this for phase seeds; it
applies to *any* bits taken from a key whose last character varies. Scramble
first.

**Blooms have to be far rarer than they sound.** 13% flowers read as a flower
meadow with grass in the gaps, because a daisy is a loud orange rosette wider
than the grass is tall and carries several times its share by eye. About 4% is
what "here and there" actually looks like. Count is the wrong unit; the
screenshot is the right one.

**A field needs height, tone and gaps or it reads as mown.** Uniform scale and a
single green came back looking generated. Per-plant height (0.70–1.32) and four
tones of the one pen — mixed toward `ink` or `paper`, both colours the theme
already owns — plus a two-wave thinning that lets paper show through are what
turn a texture into a drawing.

Density is two regimes with a crossover, and both are needed: constant *world*
pitch is what a real field has and is what makes the near ground honest, but it
costs plants in proportion to depth squared and carrying it to the horizon would
want about three hundred thousand of them. Constant *screen* pitch is affordable
everywhere and buries the near field. The demo takes the `max`.

**A fourth palette is a sky, and it runs on the clock.** `T` cycles
Ink → Butter → Prose → **Sky**, which is macOS's *From dawn to dusk* done in this
hand: a graded sky over the field, the app's own traced `sun` icon travelling an
arc, and after dark `SittingFigure`'s crescent and sparkles in `penBlue` — the
one licence this file already grants those marks. It opens at the real local
hour; `←`/`→` shift an hour and `F` runs a day in a minute.

Calling it a palette rather than a mode is the whole reason it was cheap. A
palette here is exactly "the ground the drawing sits on", so **one function,
`palette()`**, answers what the renderer needs — pens, `ground`, `hazeTo`,
`horizon`, and a `sky` that is null for the three paper themes. Nothing else in
the file learns that a day exists. The paper themes were verified byte-identical
before and after by diffing PNGs with the hint removed; that is worth redoing
after any change here, because a "pure refactor" of colour is exactly the kind
that silently is not.

Six things that were not obvious:

- **`hazeTo` is what makes it one picture.** Distance used to fade toward paper.
  In Sky it fades toward the horizon's own colour, so far grass dissolves into
  the sunset rather than into a pale band standing in front of it.
- **The ground has to fade on the same curve.** With a flat fill below the
  horizon, the sky's hot band stopped dead and the field began as flat dark — a
  ruled line across the picture. The fix is a second gradient whose stops are
  *derived*: screen y maps to a depth through the same projection that placed the
  plants, and that depth goes through the same Beer's law. Grass and the ground
  under it then dissolve together, which is why the seam disappears instead of
  merely softening. It needs `f` and `near` published out of `buildField()`,
  alongside `horizonY`.
- **The shape fill needed the same treatment.** A closed path was filled with
  flat paper, which was right when ground and distance were the same colour.
  Against a coloured sky a flat dark fill inside an orange-hazed stroke reads as
  a hole punched in the drawing.
- **A hairline appeared along the horizon after dark, from two causes at once.**
  The horizon sat on a fractional pixel, so the sky rect and the ground rect each
  anti-aliased against the flat fill underneath — and after dark that fill is
  near-black against a lit horizon. And the ground gradient stopped 10% short of
  the horizon colour, because it had borrowed `HAZE_MAX` from the plants. That
  cap exists so far grass never dissolves completely and the horizon keeps its
  texture; the ground plane needs the opposite, since at infinite distance it
  *is* the horizon. Round the horizon to whole pixels, overlap the two rects by
  one, and let the ground reach `hazeTo` exactly.
- **The moon crosses the sky the same way the sun does.** Both rise in the east
  and set in the west; only their timing differs. Running the moon back the other
  way reads as wrong even to someone not thinking about it.
- **RGB lerp between keyframes goes through mud.** Purple pre-dawn to cream
  morning passes through dead grey, and amber to aubergine through brown. Two
  extra keyframes at 07:00 and 19:24 fix it. This is the sort of thing a palette
  sheet catches in one look and a running demo hides for days — render the
  keyframes as a strip before wiring them in.

Sky costs nothing: it measures *cheaper* than the paper themes (6.7ms against
7.6ms) because its horizon sits lower and there is less field to draw. The
palette tables rebuild on a quantised time step, 480 to a day, never per frame.

The hint does not auto-hide, and it names the palette (`Ink`, or `Sky 21:15`).
Both halves are there for the same reason: `←`/`→` and `F` do nothing visible on
a paper theme, because there is no hour there to change, and an hour's scrub
through the flat middle of the afternoon moves the sky so little that the key
looks broken anyway. Naming the state is cheaper than either — and a page whose
whole surface is keyboard should not dismiss its own key list on the first key
pressed.

One drift risk the tooling does not cover: the moon and stars are pasted from
`SittingFigure.tsx`, and `lab-data.py` lifts species, themes and icons only. The
sun is safe — it comes from `DATA.icons`.

As with the bench and the web preview: decide here, confirm on the phone. This
one is a desktop page and nothing in it ships.
