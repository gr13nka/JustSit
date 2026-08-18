#!/usr/bin/env node
/**
 * Print the drawing sheets you draw the app's art on.
 *
 * Usage:  node scripts/drawing-sheets.mjs            # the three base sheets
 *         node scripts/drawing-sheets.mjs --blooms   # pass two, once growth is traced
 *
 * A sheet is a jig, not a design. Its whole job is to make the scan you hand
 * back *measurable*: every mark arrives inside a box of known size at a known
 * place on a page of known proportion, so a drawing can be mapped onto the
 * 48-unit canvas the app draws on without anybody eyeballing a scale factor.
 *
 * Three things on the page do real work:
 *
 * - The **corner marks** are the only solid black outside the boxes. They fix
 *   the export's scale and offset whatever resolution it comes back at, and
 *   they survive any thresholding, because they are ink-black rather than grey.
 * - The **calibration bar** is exactly one nib wide at this box size. Stroke
 *   weight is the one property that cannot be recovered after the fact: if each
 *   mark is normalised to its own bounding box, a small drawing and a large one
 *   come back with wildly different-looking pens, and the app's claim that one
 *   hand drew all of it collapses. Matching the bar once, by eye, fixes it.
 * - Every guide line is **thin and grey**. Thin, so that a morphological
 *   opening removes it even if the device exports 1-bit and dithers the grey
 *   into black dots; grey, so that a plain threshold usually removes it first.
 *
 * The page is 1404 x 1872, which is a Boox Go 10.3's panel exactly, so a
 * full-screen note is one device pixel per unit and nothing resamples.
 *
 * No dependencies: this drives the Chromium already on the machine over the
 * DevTools protocol, the same way scripts/preview-shot.mjs does.
 */
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'art/templates');

/* ── geometry ───────────────────────────────────────────────────────────── */

const PAGE = { w: 1404, h: 1872 };

/**
 * The box is sized so that the device's *widest* brush lands on the nominal nib.
 *
 * The first sheets used a 480px box, which asked for a 28px stroke — about 3.1mm
 * on a Go 10.3's panel, and its pen stops at 2.0mm. No brush on the device could
 * reach the calibration bar, so both attempts came in light (34%, then 77%) and
 * the second was as close as the hardware allows.
 *
 * 370 is measured, not derived from millimetres: the widest brush laid down 2.16
 * units in a 480px box, so 21.6px of ink, and 21.6px is 2.8 units of a 370px box.
 * Two consequences worth keeping. The instruction stops being "match this bar by
 * eye" and becomes "use the biggest brush", which is a setting rather than a
 * judgement. And every sheet must keep this box: marks drawn in boxes of
 * different sizes carry different stroke weights into the same app, which is
 * invisible until they sit side by side.
 */
const BOX = 370;
const UNIT = BOX / 48;
const NIB = 2.8 * UNIT;             // 21.6px — the Go 10.3's widest pen
const SAFE = 3 * UNIT;              // the margin the round nib needs
const BASELINE = 43 * UNIT;         // where every plant is rooted

const COLS = 3;
const ROWS = 3;
const PER_SHEET = COLS * ROWS;
const GAP_X = 55;
const GAP_Y = 110;
const LABEL_H = 62;
const HEADER_H = 170;
const MARGIN_X = (PAGE.w - COLS * BOX - (COLS - 1) * GAP_X) / 2;

const cellAt = (i) => ({
  x: MARGIN_X + (i % COLS) * (BOX + GAP_X),
  y: HEADER_H + Math.floor(i / COLS) * (BOX + LABEL_H + GAP_Y),
});

/* ── what gets drawn ────────────────────────────────────────────────────── */

/**
 * Every mark, in drawing order, with the kind that decides its guides.
 *
 * A flat list rather than a list of sheets: how many fit on a page is a
 * consequence of the box size, and the box size is fixed by the device's pen.
 * Paginating here means changing one of those never silently drops a mark.
 */
const MARKS = [
  ['garden', 'icon', 'sprout, two leaves'],
  ['you', 'icon', 'head and shoulders'],
  ['arrow-right', 'icon', 'onward · overshoot the tip'],
  ['arrow-left', 'icon', 'back out · draw it fresh'],
  ['sun', 'icon', 'one day · bowed rays'],
  ['leaf', 'icon', 'one thing that grew'],
  ['grass', 'plant', 'three blades, apart'],
  ['sprout', 'plant', 'stem, two leaves'],
  ['clover', 'plant', 'stem, three lobes'],
  ['fern', 'plant', 'one frond, paired leaflets'],
  ['tulip', 'plant', 'stem + leaves; bloom later'],
  ['daisy', 'plant', 'stem + leaves; bloom later'],
  ['mushroom', 'plant', 'stalk and cap, one colour'],
  ['thistle', 'plant', 'stem only; head later'],
  ['poppy', 'plant', 'stem only; flower later'],
  ['reed', 'plant', 'tall stems, a slight lean'],
  ['berry', 'plant', 'stem + leaves; fruit later'],
  ['sapling', 'plant', 'trunk and a few branches'],
];

const SHEETS = Array.from({ length: Math.ceil(MARKS.length / PER_SHEET) }, (_, i) => {
  const cells = MARKS.slice(i * PER_SHEET, (i + 1) * PER_SHEET);
  const kinds = [...new Set(cells.map((c) => c[1]))];
  return {
    id: `sheet-${i + 1}`,
    title: kinds.length === 1 ? `${kinds[0]}s` : kinds.map((k) => k + 's').join(' and '),
    cells,
  };
});

const BLOOM_SHEET = {
  id: 'blooms',
  title: 'blooms — draw on top of your own growth',
  cells: [
    ['tulip', 'bloom', 'the cup — pink'],
    ['daisy', 'bloom', 'the petals — orange'],
    ['thistle', 'bloom', 'the head — pink'],
    ['poppy', 'bloom', 'the flower — orange'],
    ['berry', 'bloom', 'the fruit — blue'],
  ],
};

/* ── drawing the page ───────────────────────────────────────────────────── */

const fontUrl = (file) => `file://${resolve(ROOT, 'assets/fonts', file)}`;

function corner(x, y, dx, dy) {
  const ARM = 80;
  return `<path d="M${x + dx * ARM},${y} L${x},${y} L${x},${y + dy * ARM}"
    fill="none" stroke="#000" stroke-width="8" />`;
}

function cell({ x, y }, kind, key, hint, underlay) {
  const guide = '#BFBFBF';
  const faint = '#DCDCDC';
  const marks = [];

  // The canvas bound. Cropped inside during tracing, so it never reaches the art.
  marks.push(`<rect x="${x}" y="${y}" width="${BOX}" height="${BOX}"
    fill="#fff" stroke="${guide}" stroke-width="2" />`);

  // The nib's own margin. Anything past it clips when the mark is drawn small.
  marks.push(`<rect x="${x + SAFE}" y="${y + SAFE}" width="${BOX - 2 * SAFE}" height="${BOX - 2 * SAFE}"
    fill="none" stroke="${faint}" stroke-width="2" stroke-dasharray="10 14" />`);

  if (kind === 'icon') {
    const cx = x + BOX / 2;
    const cy = y + BOX / 2;
    for (const [x1, y1, x2, y2] of [
      [cx, cy - 18, cx, cy + 18],
      [cx - 18, cy, cx + 18, cy],
    ]) {
      marks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${faint}" stroke-width="2" />`);
    }
  } else {
    // Every plant is rooted here, so a plot of them shares one ground line.
    const by = y + BASELINE;
    marks.push(`<line x1="${x + SAFE}" y1="${by}" x2="${x + BOX - SAFE}" y2="${by}"
      stroke="${guide}" stroke-width="2" stroke-dasharray="18 12" />`);
    marks.push(`<text x="${x + BOX - SAFE}" y="${by - 10}" text-anchor="end"
      font-size="17" fill="${faint}">root here</text>`);
  }

  if (underlay) {
    marks.push(`<g transform="translate(${x},${y}) scale(${UNIT})"
      fill="none" stroke="#C4C4C4" stroke-width="2.8"
      stroke-linecap="round" stroke-linejoin="round">${underlay}</g>`);
  }

  marks.push(`<text x="${x}" y="${y + BOX + 30}" font-size="25" font-weight="500" fill="#111">${key}</text>`);
  marks.push(`<text x="${x}" y="${y + BOX + 54}" font-size="19" fill="#8A8A8A">${hint}</text>`);
  return marks.join('\n');
}

function sheet(spec, index, total, underlays = {}) {
  const cells = spec.cells
    .map(([key, kind, hint], i) => cell(cellAt(i), kind, key, hint, underlays[key]))
    .join('\n');

  const barX = 700;
  const barY = 92;
  const rule = spec.cells.some(([, kind]) => kind === 'bloom')
    ? 'draw only the bloom — the grey is your own growth, already traced'
    : 'black only · the widest brush the device has · stay inside the dashed inset';

  return `
  <svg class="sheet" viewBox="0 0 ${PAGE.w} ${PAGE.h}" width="${PAGE.w}" height="${PAGE.h}"
       xmlns="http://www.w3.org/2000/svg">
    <rect width="${PAGE.w}" height="${PAGE.h}" fill="#fff" />

    ${corner(30, 30, 1, 1)}
    ${corner(PAGE.w - 30, 30, -1, 1)}
    ${corner(30, PAGE.h - 30, 1, -1)}
    ${corner(PAGE.w - 30, PAGE.h - 30, -1, -1)}

    <text x="${MARGIN_X}" y="58" font-size="34" font-weight="700" fill="#111">JustSit · ${spec.title}</text>
    <text x="${MARGIN_X}" y="96" font-size="22" fill="#8A8A8A">sheet ${index + 1} of ${total}</text>
    <text x="${MARGIN_X}" y="132" font-size="22" fill="#8A8A8A">${rule}</text>

    <text x="780" y="48" font-size="20" fill="#8A8A8A">your widest brush</text>
    <line x1="780" y1="80" x2="960" y2="80"
          stroke="#000" stroke-width="${NIB}" stroke-linecap="round" />
    <text x="990" y="48" font-size="20" fill="#8A8A8A">test a stroke here</text>
    <rect x="990" y="60" width="242" height="72"
          fill="none" stroke="#DCDCDC" stroke-width="2" stroke-dasharray="10 14" />

    ${cells}
  </svg>`;
}

function page(sheets, underlays) {
  return `<!doctype html><meta charset="utf-8">
<style>
  @font-face { font-family: 'MPR'; font-weight: 500; src: url('${fontUrl('MPLUSRounded1c_500Medium.ttf')}'); }
  @font-face { font-family: 'MPR'; font-weight: 700; src: url('${fontUrl('MPLUSRounded1c_700Bold.ttf')}'); }
  @page { size: ${PAGE.w / 96}in ${PAGE.h / 96}in; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  svg { display: block; font-family: 'MPR', system-ui, sans-serif; }
  svg.sheet { break-after: page; }
  svg.sheet:last-of-type { break-after: auto; }
</style>
${sheets.map((s, i) => sheet(s, i, sheets.length, underlays)).join('\n')}`;
}

/* ── driving the browser ────────────────────────────────────────────────── */

const CANDIDATES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
].filter(Boolean);

const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) {
  console.error('No Chromium-family browser found. Set $CHROME to one.');
  process.exit(1);
}

const blooms = process.argv.includes('--blooms');
const sheets = blooms ? [BLOOM_SHEET] : SHEETS;
const name = 'justsit';

let underlays = {};
const tracedPath = resolve(ROOT, 'art/traced/growth.json');
if (blooms) {
  if (!existsSync(tracedPath)) {
    console.error(`No traced growth at ${tracedPath} — trace the plant sheets first.`);
    process.exit(1);
  }
  const traced = JSON.parse(readFileSync(tracedPath, 'utf8'));
  underlays = Object.fromEntries(
    Object.entries(traced).map(([k, paths]) => [k, paths.map((d) => `<path d="${d}"/>`).join('')]),
  );
}

mkdirSync(OUT, { recursive: true });
const html = page(sheets, underlays);
const htmlPath = resolve(OUT, `${name}.html`);
writeFileSync(htmlPath, html);

const PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(browser, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--allow-file-access-from-files',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/justsit-sheets-profile',
  'about:blank',
], { stdio: 'ignore' });

async function debuggerUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = tabs.find((t) => t.type === 'page');
      if (p) return p.webSocketDebuggerUrl;
    } catch { /* port not open yet */ }
    await sleep(250);
  }
  throw new Error('Chromium never exposed a DevTools target.');
}

const socket = new WebSocket(await debuggerUrl());
await new Promise((r) => (socket.onopen = r));
let seq = 0;
const waiting = new Map();
socket.onmessage = (e) => {
  const m = JSON.parse(e.data);
  const p = waiting.get(m.id);
  if (!p) return;
  waiting.delete(m.id);
  m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: PAGE.w, height: PAGE.h, deviceScaleFactor: 1, mobile: false,
});
await send('Page.navigate', { url: `file://${htmlPath}` });
await sleep(1500);

const pdf = await send('Page.printToPDF', {
  paperWidth: PAGE.w / 96,
  paperHeight: PAGE.h / 96,
  marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
  printBackground: true,
  preferCSSPageSize: true,
});
writeFileSync(resolve(OUT, `${name}.pdf`), Buffer.from(pdf.data, 'base64'));

for (let i = 0; i < sheets.length; i++) {
  await send('Runtime.evaluate', {
    expression: `document.querySelectorAll('svg.sheet')[${i}].scrollIntoView({behavior:'instant',block:'start'})`,
  });
  await sleep(200);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(OUT, `${name}-${sheets[i].id}.png`), Buffer.from(shot.data, 'base64'));
}

// The sheet generator owns the page geometry; the tracer must not re-derive it.
// This manifest is the seam between them: where every box landed, in page units.
writeFileSync(resolve(OUT, `${name}.manifest.json`), JSON.stringify({
  page: PAGE,
  unit: UNIT,
  nib: NIB,
  corners: [[30, 30], [PAGE.w - 30, 30], [30, PAGE.h - 30], [PAGE.w - 30, PAGE.h - 30]],
  sheets: sheets.map((s, i) => ({
    id: s.id,
    file: `${name}-${s.id}.png`,
    cells: s.cells.map(([key, kind], j) => ({
      key,
      kind,
      ...cellAt(j),
      size: BOX,
      safe: SAFE,
      baseline: kind === 'icon' ? null : BASELINE,
    })),
  })),
}, null, 2));

console.log(`${OUT}/${name}.pdf  +  ${sheets.length} png  (${PAGE.w}x${PAGE.h}, box ${BOX}, nib ${NIB})`);
socket.close();
proc.kill();
process.exit(0);
