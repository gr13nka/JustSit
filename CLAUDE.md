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
npm test           # 112 unit tests (Jest)
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
  theme/             tokens.ts (all colour), typography.ts (type scale)
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

Wallace's criterion for advancing is the state of your mind, not attendance. The
thresholds decide only when it is *reasonable to ask*.

## Design discipline

**Colour has exactly one job.** Terracotta = you can touch this. Sage = something
grew. Nothing else uses either; everything structural is paper and ink.
**No hex literal may appear outside `src/theme/tokens.ts`.**

**Two typefaces, hard boundary.** IBM Plex Mono carries everything structural —
timer, labels, nav, stats, buttons. Newsreader (serif) carries the teaching card
body and *nothing else*. A paragraph of Wallace in mono reads like a terminal; in
serif it reads like a book being handed to you. That switch does real emotional
work and stops working if it leaks.

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
indistinguishable from a frozen app. The hairline elapsed arc behind it is
deliberately the quietest mark on the screen, and is in `color.line` rather than
sage: sage means *something grew*, and elapsed time has not grown anything.

**At most one primary button per screen.** Any second action is `variant="quiet"`.

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

**Import Google Fonts by subpath** — `@expo-google-fonts/newsreader/400Regular`,
not `@expo-google-fonts/newsreader`. The package root `require`s every weight, so
importing from it bundles all 14 faces (~1.6MB) to use one. This took the bundle
from 28 font files to 5.

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

## Placeholder art

Two things are stand-ins, each isolated so swapping it touches one file.

**Plants** — line-art SVG in `src/ui/Plant.tsx`. Real art will be transparent
PNGs at @3x in `assets/plants/`. Identity (`src/domain/plants.ts`) is kept
separate from rendering (`src/ui/Plant.tsx`) precisely so this is a one-file
change. Note PNGs **cannot be tinted in code** — each plant carries the colours
it was drawn in, which is why `sage` is a UI-only accent and never a plant colour.

**Bells** — synthesised inharmonic bowl tones. Regenerate with
`node scripts/generate-placeholder-bells.mjs`, or replace
`assets/audio/bell-*.wav` with real recordings.

`src/ui/SittingFigure.tsx`, the onboarding illustration, is also placeholder.

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
