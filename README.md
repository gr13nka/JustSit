# JustSit

A meditation app that teaches B. Alan Wallace's *The Attention Revolution* slowly,
and grows a hand-drawn garden as you go.

The design goal is a **quiet** app. Almost every decision trades engagement
mechanics for calm: no streak anxiety, no failure copy, no ambient sound, no
badges. The one thing that accumulates is the garden, and it only ever shows
completed sittings.

## Running it

```sh
npm start          # then scan the QR code with Expo Go
npm test           # the unit suite over the pure logic
npm run typecheck
```

### Expo Go vs a standalone build

Sitting, bells, the garden, tips and progression all work in Expo Go.

**Notifications do not.** Expo pulled push support out of Expo Go in SDK 53, and
on Android the module now throws the moment it is imported — which, at module
scope, takes down the whole route tree. `src/session/notifications.ts` therefore
detects Expo Go and never requires the module there, so two things quietly
no-op:

- the daily reminder
- the safety-net notification when a sitting ends while the app is backgrounded
  (the in-app bell still rings whenever the app is in the foreground)

Both work normally in a real build. With an Android phone plugged in and USB
debugging accepted:

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
| **Planting** | One plant per completed session. Quit early and nothing grows — no message, no guilt. |
| **Garden** | Plots of 108 (the mala bead count). Fill one and it archives; a fresh plot opens. |
| **Curriculum** | Wallace's ten stages. The app offers to advance after ~20 sessions across 3+ weeks; **you** confirm whether the next stage describes your mind. Declining is respected for a fortnight. |
| **Tips** | One card before each sitting, in order, drawn from your current stage. |
| **Duration** | Your stage pre-selects a length; every option stays tappable. |
| **Themes** | Three palettes — Ink, Butter, Prose — chosen in the You tab. Taste only: nothing about the practice changes. |
| **Sound** | One bell in, one bell out. Nothing between. |
| **Reminders** | One daily notification, off until you set a time. |

## Where things live

```
app/                 screens (expo-router)
  (tabs)/            Garden · You
  session/           start → tip → run → complete → advance   (outside the tab bar)
  onboarding.tsx
src/
  theme/themes.ts    ← every colour in the app, in three palettes
  theme/tokens.ts    space, radius, organic corners
  theme/typography.ts
  store/             the only module that touches persistence
  domain/            pure, tested: stages, tips, progression, plots, plants, stats
  session/           timer, bells, notifications
  ui/                shared components
```

The visual language is Karakuli — warm paper, one round-nib pen, colour that is
earned — at its most austere setting. The rules live in CLAUDE.md's "Design
discipline" section, which is the authoritative copy; the two worth knowing
before touching anything:

- **No hex literal outside `src/theme/themes.ts`,** and colour is read through
  `useColor()` rather than imported — a `StyleSheet.create` is frozen at import
  and cannot repaint. Touchability is marked by shape and by the app's single
  accent (ink, or brick in the two loud themes); everything else colourful is
  the garden's green, plus a fixed pen-bright bloom per species.
- **Two typefaces, hard boundary.** M PLUS Rounded 1c carries everything read
  for information; Shantell Sans is a voice for one-line felt moments and never
  carries a paragraph.

## The art

**Plants** are hand-drawn pen doodles in `src/ui/Plant.tsx` and may be the
final art. If painted PNGs ever replace them: drop transparent @3x files into
`assets/plants/`, list their keys in `src/domain/plants.ts`, and rewrite
`Plant.tsx` to render an `<Image>`. Identity and rendering are kept in separate
files precisely so this is a one-file change.

Adding species later is always safe: a session stores the plant key it resolved
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

The You tab has a `__DEV__`-only panel (stripped from release builds): seed
sessions, jump stages, and arm the advancement offer — because the interesting
states of this app are the slow ones.
