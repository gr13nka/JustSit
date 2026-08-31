# JustSit — the full guide

Everything the [README](../README.md) leaves out. The invariants that make the
app subtly wrong when they are broken live in [CLAUDE.md](../CLAUDE.md).

- [What it is](#what-it-is)
- [Running it](#running-it)
  - [Expo Go vs a standalone build](#expo-go-vs-a-standalone-build)
- [How it works](#how-it-works)
- [Where things live](#where-things-live)
- [The art](#the-art)
- [The one thing most likely to break](#the-one-thing-most-likely-to-break)
- [Dev shortcuts](#dev-shortcuts)
- [Credits](#credits)

## What it is

A meditation app that teaches B. Alan Wallace's *The Attention Revolution* slowly,
and grows a hand-drawn garden as you go.

The design goal is a **quiet** app, and quiet is about voice rather than
austerity. It grows, it offers, it counts days and keeps what you wrote down;
what it never does is raise its voice about any of it: no congratulation, no
failure copy, no ambient sound, no badges. The garden only ever shows completed
sittings.

## Running it

```sh
npm start          # then scan the QR code with Expo Go
npm run web        # the same app in a browser, for judging layout
npm test           # the unit suite over the pure logic
npm run typecheck
```

`npm run web` is a preview target, not a platform — no web build ships. It exists
because every screen here centres its middle block with `flex: 1`, so the layout
breathes differently at 667pt of height than at 911, and a browser is the only
place to see all of those at once. See CLAUDE.md for the screen sizes worth
checking and what had to be handled for the preview to tell the truth.

### Running it on iOS

Expo Go on an iPhone needs no build at all: `npm start`, then enter the
`exp://<your-lan-ip>:8081` URL in Expo Go on a phone sharing the Mac's Wi-Fi.
`npx expo export --platform ios` compiles the iOS bundle without a phone, which
is the quickest way to prove a change has not broken the platform.

A *native* iOS build is a different matter: SDK 57 requires Xcode 26.4+ and a
Mac new enough to run it, and there is no `ios/` directory or
`ios.bundleIdentifier` in this repo yet. The cheapest route when one is needed
is an EAS cloud simulator build, which needs no Apple Developer account.

### Expo Go vs a standalone build

Sitting, bells, the garden, tips and progression all work in Expo Go.

**Notifications do not — on Android.** Expo pulled push support out of Expo Go in
SDK 53, and on Android the module now throws the moment it is imported — which,
at module scope, takes down the whole route tree.
`src/session/notifications.ts` therefore detects Expo Go on Android and never
requires the module there, so two things quietly no-op:

- the daily reminder
- the safety-net notification when a sitting ends while the app is backgrounded
  (the in-app bell still rings whenever the app is in the foreground)

**On iOS none of that applies.** The throw is gated on `Platform.OS ===
'android'`, so Expo Go on an iPhone loads the module and schedules real local
notifications — which is safe here because nothing in this app ever asks for a
push token. Both paths should be testable in Expo Go on iOS.

Both work normally in a real Android build. With an Android phone plugged in and
USB debugging accepted:

```sh
./build-android.sh      # typecheck, tests, release APK, install, launch
```

That installs a self-contained app — the JS bundle is embedded, so it runs with
the laptop unplugged and never looks for Metro. Expo signs the release with its
fixed debug keystore, so rebuilding installs over the old app and leaves your
garden intact. It is not signed for the Play Store.

The installed app is a different Android package from Expo Go, with its own
storage: sittings recorded in Expo Go stay in Expo Go, and there is no way to
carry them across.

## How it works

| | |
|---|---|
| **Planting** | A completed sitting offers three plants; you choose the one that grows. A longer sitting may offer a rarer plant, or a few common ones instead. Quit early and nothing grows — no message, no guilt. |
| **Garden** | One bed, and it only grows: 3 to start, then 6, then 12, then another row of twelve each time it fills. You confirm each step; there is no size to pick. 108 is a mala, and the bed carries on past it. |
| **Growing it** | When the bed fills it asks. The garden comes up out of the ground and the new room opens beside it, faint until you agree to it — the one place the app celebrates, and what it celebrates is the bed being full rather than anything about you. |
| **Curriculum** | Wallace's ten stages. The app offers to advance after ~20 sessions across 3+ weeks; **you** confirm whether the next stage describes your mind. Declining is respected for a fortnight. |
| **Tips** | One card before each sitting, in order, drawn from your current stage. |
| **Duration** | Your stage pre-selects a length; every option stays tappable. |
| **Themes** | Three palettes — Ink, Butter, Prose — chosen in the You tab. Taste only: nothing about the practice changes. |
| **Sound** | One bell in, one bell out. Nothing between. |
| **Reminders** | One daily notification, off until you set a time; its line changes from day to day. |
| **Days** | On a day you sat, the streak's sun turns green and Батон naps beside the garden. Miss a day and nothing is said. Touch the sun for **Your days**: this week, the last four, the current run and the longest one. No percentages, no pace, and no mark for a day you missed. |
| **Notes** | A thought caught mid-sitting becomes a note; long-press the plant that grew to read it. |

## Where things live

```
app/                 screens (expo-router)
  (tabs)/            Garden · You
  session/           start → tip → run → complete → advance   (outside the tab bar)
  garden/            grow — the ask when the bed is full
  notes/             the notes and one note
  streak.tsx         your days — the week, the month, the run
  onboarding.tsx
src/
  theme/themes.ts    ← every colour in the app, in one palette
  theme/tokens.ts    space, radius, organic corners
  theme/typography.ts
  store/             the only module that touches persistence
  domain/            pure, tested: stages, tips, progression, plots, plants, stats, notes
  session/           timer, bells, notifications, reminder lines
  ui/                shared components
  ui/carry.ts        the arithmetic of a card being held — pure, tested
```

The visual language is Karakuli — warm paper, one round-nib pen, colour that is
earned — at its most austere setting. The rules live in CLAUDE.md's "Design
discipline" section, which is the authoritative copy; the two worth knowing
before touching anything:

- **No hex literal outside `src/theme/themes.ts`,** and colour is read through
  `useColor()` rather than imported — a `StyleSheet.create` is frozen at import
  and cannot repaint. Touchability is marked by shape and by the app's single
  accent (ink); the plants are drawn in ink too, and green is kept for the marks
  that report something grew — the sun on a day already sat, and a tally's
  stroke — plus a fixed pen-bright bloom per species. The one mark that is not
  about touchability is the note card's shadow, the app's only one: holding
  earns it, sitting on a page does not.
- **Two typefaces, and the boundary is who is speaking.** M PLUS Rounded 1c
  carries what the app says — everything read for information. Shantell Sans is
  a voice: the app's name, one-line felt moments, and every note, because what
  you wrote is not the app talking.

## The art

**Plants** are hand-drawn pen doodles in `src/ui/Plant.tsx` and may be the
final art. If painted PNGs ever replace them: drop transparent @3x files into
`assets/plants/`, list their keys in `src/domain/plants.ts`, and rewrite
`Plant.tsx` to render an `<Image>`. Identity and rendering are kept in separate
files precisely so this is a one-file change.

Adding species later is always safe: a session stores the plants it grew, chosen
at completion, so plants that already grew never change.

Note PNGs can't be tinted in code — each plant carries the colours you drew it
in, and would stop following the theme the way the drawn plants do. Worth
keeping them in a range that sits well on all three papers, the lightest of
which is Prose's near-white and the warmest Butter's.

**Bells are still placeholders** — synthesised bowl tones. Regenerate with
`node scripts/generate-placeholder-bells.mjs`, or just replace
`assets/audio/bell-in.wav` and `bell-out.wav` with real recordings.

## The one thing most likely to break

Session timing is derived from wall-clock on every tick and on every return to
the foreground — never counted down. JavaScript timers stop when the app is
backgrounded, so a counted timer silently loses exactly the time you spent away.
If you touch `src/session/useSession.ts`, re-check: start a 10-minute sitting,
background the app for 3 minutes, come back, and confirm the remaining time
reflects real elapsed time.

## Dev shortcuts

The You tab has a developer panel — always in a dev build, and in a release build
once you turn on **Developer** at the foot of the You tab: seed sittings, jump
stages, arm the advancement offer, and make every sitting end after five seconds
while still counting as the length you chose — because the interesting states of
this app are the slow ones. The **Reset** card above it starts the garden again
and keeps your settings.

## Credits

MIT licensed — see [LICENSE](../LICENSE). The practice is B. Alan Wallace's, and
the app paraphrases it rather than quoting it. The drawing is Karakuli, the
author's own design system: warm paper, one soft round-nib pen, colour that is
earned. Батон, the sleeping loaf cat, holds the quiet places.
