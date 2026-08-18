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

`Session.slot` is the same idea applied to position. A sitting starts by touching
an empty dot, so the user chose that dot and nothing may move the plant
afterwards. The slot is absolute across the whole garden — plot is
`slot / PLOT_SIZE`, cell within it is `slot % PLOT_SIZE`. Position used to be
array order; deriving it again would silently rearrange gardens people keep.

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
| A sitting starts by touching an empty dot, and grows there | `ui/PlantGrid.tsx` → `app/session/start.tsx` |
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
beyond those is. Every drawn path is cubic béziers with round caps and baked-in
wobble: no `Circle`, no `Rect`, no ruler-straight lines, no perfect arcs. Two
of them are filled rather than stroked — the empty slot's dot (`Plant.tsx`'s
`EmptySlot`) and the wobbly button's own shape — and nothing else may be. The
pen contract lives in `src/ui/pen.ts`: doodles draw at 2.8 on a 48-unit canvas,
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

**Motion lives in `src/ui/motion.tsx`, and none of it loops.** An *entrance*
(`Sprout`, `Rise`) marks a first appearance; a *settle* (`usePressSettle`) is
feedback for a touch. Everything animates transform and opacity only, so every
driver is native. The breathing ring is the one exception and owns its own loop,
because there the loop is the point.

**The garden bursts on every visit, not once per launch.** `useBurst` runs one
shared 0..1 clock and each `Sprout` reads its own window out of it, so 108 cells
cost one driver. `app/(tabs)/index.tsx` restarts it from `useFocusEffect` — the
tab stays mounted, so a mount effect would fire exactly once in the life of the
app. Delays are seeded from the slot (`hash32('burst-' + slot)`), never random:
a field that re-rolled its timings would be a different drawing each visit.

The whole field lands in under half a second — 200ms per doodle scattered across
280 — and each one is **squash and stretch**, not a fade-up. `GROWTH` in
`motion.tsx` is the curve, written as frames rather than parallel arrays because
the character is in how the channels disagree at a moment: the doodle shoots
past full height while still pinched narrow, swings back under it as it widens,
then settles. `scaleX` and `scaleY` must never reach their extremes together, or
it reads as a bubble inflating rather than as something growing. This is livelier
than the kit's ~300/450 default on purpose; the garden is the one place this app
is allowed to be pleased with itself, and the burst is over before it could
become a thing you wait through.

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

**Plants** (`src/ui/Plant.tsx`) are Karakuli pen doodles — twelve species, each
with a fixed bloom colour that is a property of the species, never of the
session — and are candidates to be the final art rather than stand-ins. If
hand-painted PNGs ever replace them, identity (`src/domain/plants.ts`) is kept
separate from rendering precisely so that stays a one-file change; note PNGs
cannot be tinted in code, so each would carry its own colours. `SittingFigure`
and `Baton` follow the same pen contract and come from the Karakuli kit's hand.

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
decide in the browser and confirm on the phone. Three things needed handling for
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
