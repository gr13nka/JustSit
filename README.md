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
npm test           # 81 unit tests over the pure logic
npm run typecheck
```

### Expo Go vs a development build

Sitting, bells, the garden, tips and progression all work in Expo Go.

**Notifications do not.** Expo pulled push support out of Expo Go in SDK 53, and
on Android the module now throws the moment it is imported — which, at module
scope, takes down the whole route tree. `src/session/notifications.ts` therefore
detects Expo Go and never requires the module there, so two things quietly
no-op:

- the daily reminder
- the safety-net notification when a sitting ends while the app is backgrounded
  (the in-app bell still rings whenever the app is in the foreground)

Both work normally in a development build:

```sh
npx expo run:android    # needs the Android SDK installed
```

## How it works

| | |
|---|---|
| **Planting** | One plant per completed session. Quit early and nothing grows — no message, no guilt. |
| **Garden** | Plots of 108 (the mala bead count). Fill one and it archives; a fresh plot opens. |
| **Curriculum** | Wallace's ten stages. The app offers to advance after ~20 sessions across 3+ weeks; **you** confirm whether the next stage describes your mind. Declining is respected for a fortnight. |
| **Tips** | One card before each sitting, in order, drawn from your current stage. |
| **Duration** | Your stage pre-selects a length; every option stays tappable. |
| **Sound** | One bell in, one bell out. Nothing between. |
| **Reminders** | One daily notification, off until you set a time. |

## Where things live

```
app/                 screens (expo-router)
  (tabs)/            Garden · Sit · You
  session/           tip → run → complete → advance   (outside the tab bar)
  onboarding.tsx
src/
  theme/tokens.ts    ← every colour in the app
  theme/typography.ts
  store/             the only module that touches persistence
  domain/            pure, tested: stages, tips, progression, plots, plants, stats
  session/           timer, bells, notifications
  ui/                shared components
```

Two rules worth keeping:

- **No hex literal outside `src/theme/tokens.ts`.** Terracotta means "you can
  touch this"; sage means "this grew". Nothing else uses either.
- **Serif is for the teaching card only.** Everything structural is IBM Plex
  Mono; the tip body is Newsreader. That one switch is doing real emotional
  work, and it stops working if it leaks.

## Replacing the placeholder art

Two things are stand-ins, both isolated so swapping them touches nothing else.

**Plants** — currently line drawings in `src/ui/Plant.tsx`. Drop transparent
PNGs (@3x) into `assets/plants/`, list their keys in `src/domain/plants.ts`, and
rewrite `Plant.tsx` to render an `<Image>`. Identity and rendering are kept in
separate files precisely so this is a one-file change.

Adding species later is always safe: a session stores the plant key it resolved
at completion, so plants that already grew never change.

Note PNGs can't be tinted in code — each plant carries the colours you drew it
in. Worth keeping them in a range that sits well on `#F7F1E5`.

**Bells** — synthesised placeholders. Regenerate with
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
