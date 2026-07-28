/**
 * Generates the two placeholder bells as 16-bit PCM WAV files.
 *
 *   node scripts/generate-placeholder-bells.mjs
 *
 * These are stand-ins. A struck metal bowl has inharmonic partials — ratios
 * nothing like the neat integers of a string — plus a slow beating between two
 * nearly-identical modes, which is what makes a real bowl shimmer rather than
 * hum. That is approximated here, but it is still synthesis: replace
 * assets/audio/*.wav with real recordings when you have them, and nothing in
 * the app needs to change.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44_100;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'audio');

/** Partial ratios measured from struck bowls — deliberately not harmonic. */
const PARTIALS = [
  { ratio: 1.0, gain: 1.0, decay: 1.0 },
  { ratio: 2.71, gain: 0.42, decay: 0.62 },
  { ratio: 5.18, gain: 0.19, decay: 0.38 },
  { ratio: 8.66, gain: 0.08, decay: 0.24 },
];

/** Two modes a fraction apart beat against each other and make the shimmer. */
const BEAT_DETUNE_HZ = 0.7;

function renderBowl({ fundamental, seconds, decaySeconds }) {
  const length = Math.floor(SAMPLE_RATE * seconds);
  const samples = new Float64Array(length);

  for (const { ratio, gain, decay } of PARTIALS) {
    const freq = fundamental * ratio;
    const tau = decaySeconds * decay;
    for (let i = 0; i < length; i++) {
      const t = i / SAMPLE_RATE;
      const envelope = Math.exp(-t / tau);
      samples[i] +=
        gain *
        envelope *
        (Math.sin(2 * Math.PI * freq * t) +
          Math.sin(2 * Math.PI * (freq + BEAT_DETUNE_HZ) * t)) *
        0.5;
    }
  }

  // A few ms of attack, so the onset is a strike rather than a click.
  const attack = Math.floor(SAMPLE_RATE * 0.006);
  for (let i = 0; i < attack; i++) samples[i] *= i / attack;

  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const scale = peak > 0 ? 0.7 / peak : 0;

  const pcm = Buffer.alloc(length * 2);
  for (let i = 0; i < length; i++) {
    pcm.writeInt16LE(Math.round(samples[i] * scale * 32767), i * 2);
  }
  return pcm;
}

function wav(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // format: PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

mkdirSync(OUT_DIR, { recursive: true });

// Opening: higher and shorter — an invitation to begin.
writeFileSync(
  join(OUT_DIR, 'bell-in.wav'),
  wav(renderBowl({ fundamental: 330, seconds: 3.2, decaySeconds: 1.1 }))
);

// Closing: lower, warmer, longer — room to come back slowly.
writeFileSync(
  join(OUT_DIR, 'bell-out.wav'),
  wav(renderBowl({ fundamental: 196, seconds: 5.0, decaySeconds: 1.9 }))
);

console.log(`Wrote bell-in.wav and bell-out.wav to ${OUT_DIR}`);
