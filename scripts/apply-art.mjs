#!/usr/bin/env node
/**
 * Take a drawing sheet from scan to running app in one command.
 *
 * Usage:  npm run art                     # newest sheet-shaped image in ~/Downloads
 *         npm run art -- path/to/scan.jpg  # a specific file
 *         npm run art -- scan.jpg icons    # ...and force the sheet, skipping detection
 *         npm run art -- --no-open         # skip opening the preview in a browser
 *
 * The steps underneath (trace, codegen, preview) each stand alone and can be run
 * by hand; this exists because the *sequence* is what you repeat, and every
 * decision inside it — which file, which sheet, what to call the copy — is one
 * the pipeline can make for itself. A re-draw should cost one command, or the
 * pen weight never gets fixed.
 *
 * Nothing is overwritten: each scan lands in art/scans as the next version of
 * its sheet, so an earlier drawing stays comparable after a better one arrives.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCANS = resolve(ROOT, 'art/scans');
const IMAGES = new Set(['.jpg', '.jpeg', '.png']);
const INBOXES = [resolve(homedir(), 'Downloads'), resolve(homedir(), 'Desktop')];

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts });

/** The sheet a scan is, or null if it isn't a readable sheet at all. */
function detect(file) {
  const r = run('uv', ['run', '--quiet', 'scripts/trace-art.py', file, '--detect']);
  return r.status === 0 ? r.stdout.trim() : null;
}

/**
 * The newest image that is actually a sheet.
 *
 * Identity is decided by the tracer rather than by a filename or an aspect
 * ratio: the question "is this a sheet, and which one" already has a correct
 * answer in `trace-art.py`, and a second, looser guess here would be a second
 * thing to keep in step.
 */
function findScan() {
  const candidates = INBOXES.filter(existsSync)
    .flatMap((dir) => readdirSync(dir)
      .filter((f) => IMAGES.has(extname(f).toLowerCase()))
      .map((f) => resolve(dir, f)))
    .map((p) => ({ p, at: statSync(p).mtimeMs }))
    .sort((a, b) => b.at - a.at)
    .slice(0, 10);

  for (const { p } of candidates) {
    const sheet = detect(p);
    if (sheet) return { file: p, sheet };
  }
  return null;
}

function nextVersion(sheet, ext) {
  mkdirSync(SCANS, { recursive: true });
  const taken = readdirSync(SCANS)
    .map((f) => new RegExp(`^${sheet}-v(\\d+)\\.`).exec(f))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  const n = (taken.length ? Math.max(...taken) : 0) + 1;
  return { path: resolve(SCANS, `${sheet}-v${n}${ext}`), n };
}

/* ── resolve what to trace ──────────────────────────────────────────────── */

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const [argFile, argSheet] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let file, sheet;

if (argFile) {
  file = resolve(argFile);
  if (!existsSync(file)) {
    console.error(`No such file: ${file}`);
    process.exit(1);
  }
  sheet = argSheet ?? detect(file);
  if (!sheet) {
    console.error(`${basename(file)} is not a readable drawing sheet.\n` +
      'The four corner marks have to be in frame, uncropped and unrotated.');
    process.exit(1);
  }
} else {
  const found = findScan();
  if (!found) {
    console.error(`No drawing sheet found in ${INBOXES.map((d) => basename(d)).join(' or ')}.\n` +
      'Save the exported page there, or pass a path: npm run art -- path/to/scan.jpg');
    process.exit(1);
  }
  ({ file, sheet } = found);
  console.log(`found ${basename(file)} in ${basename(dirname(file))} -> sheet ${sheet}`);
}

/* ── keep it, trace it, wire it in ──────────────────────────────────────── */

// A scan already living in art/scans is a version; copying it would mint a
// second identical one every time it is re-traced.
let kept = file;
if (dirname(file) === SCANS) {
  console.log(`re-tracing art/scans/${basename(file)}\n`);
} else {
  const next = nextVersion(sheet, extname(file).toLowerCase());
  kept = next.path;
  copyFileSync(file, kept);
  console.log(`kept as art/scans/${basename(kept)}  (version ${next.n})\n`);
}

const traced = run('uv', ['run', '--quiet', 'scripts/trace-art.py', kept, sheet], { stdio: 'inherit' });
if (traced.status !== 0) process.exit(traced.status ?? 1);

// Codegen is all-or-nothing per kind: it refuses rather than emit a module with
// a hole in it, so a first sheet that only carries some of the icons is expected
// to fail here and is not an error worth stopping the run for.
const gen = run('node', ['scripts/art-to-code.mjs'], { stdio: 'inherit' });
if (gen.status !== 0) {
  console.log('\nPaths are traced and kept; the app was left as it was.');
}

const preview = run('node', ['scripts/art-preview.mjs', sheet], { stdio: 'inherit' });
if (preview.status === 0 && process.platform === 'darwin' && !flags.includes('--no-open')) {
  run('open', [resolve(ROOT, 'art/preview.html')]);
}
