#!/usr/bin/env node
/**
 * A page showing the traced set as the app will draw it, at the sizes it uses.
 *
 * Usage:  node scripts/art-preview.mjs [sheet]     # writes art/preview.html
 *
 * The point is the 24px column. A traced mark almost always looks good large —
 * it came off a real nib — and the mistakes that matter are the ones that only
 * appear small: too many strokes, a gap that closes, a stroke too fine to hold
 * its colour. Judging a drawing at the size it was drawn is how a detailed mark
 * reaches the tab bar and turns into a smudge.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sheet = process.argv[2] ?? 'sheet-1';
const src = resolve(ROOT, `art/traced/${sheet}.json`);
if (!existsSync(src)) {
  console.error(`No art/traced/${sheet}.json — trace a sheet first.`);
  process.exit(1);
}
const paths = JSON.parse(readFileSync(src, 'utf8'));
const reportPath = resolve(ROOT, `art/traced/${sheet}.report.json`);
const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;

const SIZES = [96, 48, 24];
const mark = (d, px) =>
  `<svg viewBox="0 0 48 48" width="${px}" height="${px}"><g fill="currentColor">${
    d.map((p) => `<path d="${p}"/>`).join('')}</g></svg>`;

const nominal = report?.nominalPen ?? 2.8;
const rows = Object.entries(paths).map(([key, d]) => {
  const pen = report?.marks?.[key]?.pen;
  const ratio = pen ? pen / nominal : null;
  const state = ratio == null ? '' : ratio < 0.8 ? ' thin' : ratio > 1.25 ? ' heavy' : ' ok';
  return `<tr>
    <th>${key}<span class="pen${state}">${
      ratio == null ? '' : `pen ${pen.toFixed(2)} · ${Math.round(ratio * 100)}%`}</span></th>
    ${SIZES.map((px) => `<td><div class="cell">${mark(d, px)}</div></td>`).join('')}
    <td class="on"><div class="cell dark">${mark(d, 24)}</div></td>
    <td class="n">${d.length}</td>
  </tr>`;
}).join('');

const pens = Object.values(report?.marks ?? {}).map((m) => m.pen).filter(Boolean);
const mean = pens.length ? pens.reduce((a, b) => a + b, 0) / pens.length : null;

writeFileSync(resolve(ROOT, 'art/preview.html'), `<!doctype html><meta charset="utf-8">
<title>${sheet} — traced</title>
<style>
  :root{--paper:#F7F3E9;--ink:#2A2622;--soft:#6B635A;--faint:#B8AE9E;--line:#DED5C2;--warn:#B04A2F}
  body{margin:0;background:var(--paper);color:var(--ink);padding:40px 28px 72px;
    font:15px/1.5 system-ui,-apple-system,sans-serif}
  .w{max-width:760px;margin:0 auto}
  h1{font-size:26px;margin:0 0 6px;letter-spacing:-.01em}
  p.sub{color:var(--soft);margin:0 0 32px;font-size:14px}
  p.sub b{color:var(--warn)}
  table{border-collapse:collapse;width:100%}
  th,td{padding:12px 8px;text-align:center;vertical-align:middle}
  thead th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);
    font-weight:600;padding-bottom:14px}
  tbody th{text-align:left;font-weight:500;font-size:14px;white-space:nowrap;padding-left:0}
  tbody th span{display:block;font-weight:400;font-size:11.5px;color:var(--faint);
    font-variant-numeric:tabular-nums}
  tbody th span.thin,tbody th span.heavy{color:var(--warn)}
  tbody tr+tr{border-top:1px solid var(--line)}
  .cell{display:flex;align-items:center;justify-content:center;min-height:96px}
  .cell.dark{background:var(--ink);color:var(--paper);border-radius:9px;min-height:52px;width:52px;margin:0 auto}
  td.n{color:var(--faint);font-size:12px;font-variant-numeric:tabular-nums}
</style>
<div class="w">
<h1>${sheet} — traced</h1>
<p class="sub">${report ? `from ${report.scan}. ` : ''}${
  mean ? `Sheet pen ${mean.toFixed(2)} of ${nominal} units — <b>${Math.round(mean / nominal * 100)}% of nominal</b>. ` : ''
}The 24px column is the one that decides things.</p>
<table>
  <thead><tr><th></th>${SIZES.map((s) => `<th>${s}px</th>`).join('')}<th>on ink</th><th>paths</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</div>
`);
console.log(`art/preview.html  ${Object.keys(paths).length} marks${mean ? `, pen ${(mean / nominal * 100).toFixed(0)}% of nominal` : ''}`);
