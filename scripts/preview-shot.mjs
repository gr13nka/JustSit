#!/usr/bin/env node
/**
 * Screenshot the web preview at a real phone viewport.
 *
 * Usage:  node scripts/preview-shot.mjs out.png [width] [height] [route]
 * e.g.    node scripts/preview-shot.mjs /tmp/garden.png 411 911 /
 *
 * Why this exists rather than `chromium --screenshot`: macOS clamps a window to
 * a minimum width of about 500px, and `--window-size` is a *window*, so a naive
 * headless shot of a 411pt phone silently lays out at ~500 and captures the
 * middle of it. Driving `Emulation.setDeviceMetricsOverride` over the DevTools
 * protocol sets the viewport directly, which is the same thing the browser's
 * device toolbar does. No dependencies: node 22 has WebSocket and fetch.
 *
 * `npm run web` must already be serving on 8081.
 */
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

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

const [, , out, width = '411', height = '911', route = '/'] = process.argv;
if (!out) {
  console.error('Usage: node scripts/preview-shot.mjs out.png [w] [h] [route]');
  process.exit(1);
}

const PORT = 9333;
const BASE = 'http://localhost:8081';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(browser, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/justsit-preview-profile',
  'about:blank',
], { stdio: 'ignore' });

async function debuggerUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = tabs.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // The browser has not opened its port yet.
    }
    await sleep(250);
  }
  throw new Error('Chromium never exposed a DevTools target.');
}

const socket = new WebSocket(await debuggerUrl());
await new Promise((resolve) => (socket.onopen = resolve));

let seq = 0;
const waiting = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  const pending = waiting.get(message.id);
  if (!pending) return;
  waiting.delete(message.id);
  message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result);
};

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: Number(width),
  height: Number(height),
  deviceScaleFactor: 1,
  mobile: true,
});
await send('Page.navigate', { url: BASE + route });

// Fonts, store hydration and the garden's burst all have to finish first.
await sleep(6000);

const { data } = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(data, 'base64'));
console.log(`${out}  ${width}x${height}  ${route}`);

socket.close();
proc.kill();
process.exit(0);
