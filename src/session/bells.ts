import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/**
 * One bell to begin, one to close, nothing between. Silence is the practice.
 */
export type Bell = 'in' | 'out';

const SOURCES = {
  in: require('../../assets/audio/bell-in.wav'),
  out: require('../../assets/audio/bell-out.wav'),
};

/**
 * Two players, created once and kept for the life of the app. Creating a player
 * per session would leak native resources; two is a fixed, trivial cost.
 */
let players: Record<Bell, AudioPlayer> | null = null;

export async function prepareBells(): Promise<void> {
  if (players) return;

  await setAudioModeAsync({
    // A meditation bell that a silent switch swallows is a broken bell.
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    // Never interrupt whatever else the user has going; we make one soft sound.
    interruptionMode: 'mixWithOthers',
  });

  players = {
    in: createAudioPlayer(SOURCES.in),
    out: createAudioPlayer(SOURCES.out),
  };
}

export function ringBell(which: Bell): void {
  const player = players?.[which];
  if (!player) return;

  // A bell may be struck again before the previous one has decayed.
  player.seekTo(0);
  player.play();
}
