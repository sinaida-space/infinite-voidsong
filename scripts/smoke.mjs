#!/usr/bin/env node
import { readdirSync, statSync } from 'fs';
import { resolve } from 'path';

const checks = [
  { path: 'dist/_headers', type: 'file' },
  { path: 'dist/robots.txt', type: 'file' },
  { path: 'dist/sitemap.xml', type: 'file' },
  { path: 'dist/llms.txt', type: 'file' },
  { path: 'dist/manifest.webmanifest', type: 'file' },
  { path: 'dist/fonts', type: 'dir' },
];

let passed = 0;
let failed = 0;

checks.forEach(({ path, type }) => {
  try {
    const stat = statSync(resolve(path));
    if (type === 'file' && stat.isFile()) {
      console.log(`✓ ${path}`);
      passed++;
    } else if (type === 'dir' && stat.isDirectory()) {
      console.log(`✓ ${path}`);
      passed++;
    } else {
      console.log(`✗ ${path} (wrong type)`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ ${path}`);
    failed++;
  }
});

console.log(`\nSmoke test: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
