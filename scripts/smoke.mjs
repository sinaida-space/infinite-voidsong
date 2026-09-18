#!/usr/bin/env node
// scripts/smoke.mjs — post-build sanity checks (issue #9 contract).
// Node only: no browser, no built module graph import. Assumes `vite build`
// has already run (`npm run smoke` composes with `npm run build` upstream;
// this script itself does not build).
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

const root = resolve(new URL('.', import.meta.url).pathname, '..');
const path = (...p) => resolve(root, ...p);

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`✓ ${label}`);
  passed++;
}

function fail(label, detail) {
  console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
  failed++;
}

function check(label, fn) {
  try {
    const detail = fn();
    if (detail === false) fail(label);
    else ok(label);
  } catch (e) {
    fail(label, e instanceof Error ? e.message : String(e));
  }
}

function readFile(rel) {
  return readFileSync(path(rel), 'utf-8');
}

// --- dist files exist ------------------------------------------------------

const DIST_FILES = [
  'dist/index.html',
  'dist/privacy.html',
  'dist/shortcuts.html',
  'dist/404.html',
  'dist/sw.js',
  'dist/og.png',
  'dist/_headers',
];

for (const file of DIST_FILES) {
  check(file, () => {
    if (!statSync(path(file)).isFile()) throw new Error('not a file');
  });
}

// --- _headers has a CSP -----------------------------------------------------

check('dist/_headers contains Content-Security-Policy', () => {
  const headers = readFile('dist/_headers');
  if (!/Content-Security-Policy/i.test(headers)) throw new Error('missing CSP header');
});

// --- index.html content ------------------------------------------------------

const BANNED_FONTS = ['IBM Plex', 'Montserrat', 'Raleway', 'Cormorant', 'VT323'];

check('dist/index.html has og:title', () => {
  const html = readFile('dist/index.html');
  if (!/property=["']og:title["']/.test(html)) throw new Error('no og:title meta tag');
});

check('dist/index.html has <canvas id="tunnel">', () => {
  const html = readFile('dist/index.html');
  if (!/<canvas[^>]*\bid=["']tunnel["']/.test(html)) throw new Error('no #tunnel canvas');
});

check('dist/index.html has <footer>', () => {
  const html = readFile('dist/index.html');
  if (!/<footer[\s>]/.test(html)) throw new Error('no <footer> element');
});

check('dist/index.html has no banned font names', () => {
  const html = readFile('dist/index.html');
  const hit = BANNED_FONTS.find((name) => html.includes(name));
  if (hit) throw new Error(`found banned font "${hit}"`);
});

// --- 19 source keys ----------------------------------------------------------

const EXPECTED_SOURCE_KEYS = [
  'noise', 'rain', 'ocean', 'stream', 'underwater', 'wind', 'campfire',
  'cafe', 'library', 'cabin', 'fan', 'drone', 'lofi', 'plucks',
  'synthwave', 'berlin', 'house', 'chillhop', 'tone',
];

check(`src/audio/sources/index.ts lists all ${EXPECTED_SOURCE_KEYS.length} source keys`, () => {
  const src = readFile('src/audio/sources/index.ts');
  const missing = EXPECTED_SOURCE_KEYS.filter((key) => !new RegExp(`\\b${key}\\b`).test(src));
  if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
});

// --- banned copy: no clinical/therapy claims ---------------------------------

const BANNED_COPY = /tinnitus|therapy|clinical|proven|unlock/i;
const COPY_TARGETS = [
  'index.html',
  'privacy.html',
];

function walk(dir, out = []) {
  for (const entry of readdirSync(path(dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

check('no banned copy (tinnitus|therapy|clinical|proven|unlock) in src/, index.html, privacy.html', () => {
  const files = [...walk('src'), ...COPY_TARGETS];
  const hits = [];
  for (const file of files) {
    const text = readFile(file);
    const match = text.match(BANNED_COPY);
    if (match) hits.push(`${file}: "${match[0]}"`);
  }
  if (hits.length) throw new Error(hits.join('; '));
});

// --- summary -------------------------------------------------------------------

console.log(`\nsmoke: ${passed}/${passed + failed} ok`);
process.exit(failed > 0 ? 1 : 0);
