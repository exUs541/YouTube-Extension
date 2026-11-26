// Renders an HTML/SVG file to a PNG with headless Microsoft Edge (or Chrome as fallback).
//   import { render, pngSize } from './render.mjs'
//   render('page.html', 'out.png', 1280, 800)            -> opaque PNG
//   render('logo.svg', 'logo.png', 128, 128, { transparent: true })
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];
export const BROWSER = CANDIDATES.find(existsSync);
if (!BROWSER) throw new Error('No Edge/Chrome found for rendering.');

/** Width and height of a PNG file (read from the IHDR chunk). */
export function pngSize(file) {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

export function render(input, output, width, height, { transparent = false, wait = 1500 } = {}) {
  mkdirSync(path.dirname(output), { recursive: true });
  const profile = path.join(os.tmpdir(), 'ytf-render-profile');
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--force-device-scale-factor=1', '--allow-file-access-from-files',
    '--lang=en-US',   // English date formats etc. in the images
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    `--virtual-time-budget=${wait}`,
    `--default-background-color=${transparent ? '00000000' : 'FFFFFFFF'}`,
    `--screenshot=${path.resolve(output)}`,
    pathToFileURL(path.resolve(input)).href,
  ];
  const r = spawnSync(BROWSER, args, { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0 || !existsSync(output)) {
    throw new Error(`render failed for ${input}: ${r.stderr || r.stdout || r.status}`);
  }
  const got = pngSize(output);
  if (got.w !== width || got.h !== height) {
    throw new Error(`render of ${input}: expected ${width}x${height}, got ${got.w}x${got.h}`);
  }
  return output;
}
