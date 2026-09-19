#!/usr/bin/env node
// scripts/harmony-check.mjs: runs nextHarmony() 1000 times per Harmony mode and
// asserts the contract of the switch (issue #21). Node only, no browser.
// The TypeScript sources are loaded through tsx's ESM hook (a dev dependency).
import assert from 'node:assert';
import { register } from 'tsx/esm/api';

const unregister = register();
const scale = await import('../src/audio/music/scale.ts');
const { nextHarmony, setHarmonyMode, makeHarmonyCursor } = await import('../src/audio/music/harmony.ts');
const { PROGRESSION, PROGRESSION_POOL, sessionScale, romanRoot, foldShift } = scale;
const { varyCells } = await import('../src/audio/music/phrase.ts');

const RUNS = 1000;
const BAR_SEC = 3;
const key = (chords) => chords.join(' ');
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

// --- the pool: 6 to 8 circle-of-fifths chains, all diatonic ------------------------
ok(PROGRESSION_POOL.length >= 6 && PROGRESSION_POOL.length <= 8, 'pool has 6 to 8 progressions');
ok(new Set(PROGRESSION_POOL.map(key)).size === PROGRESSION_POOL.length, 'no duplicate progression in the pool');
for (const p of PROGRESSION_POOL) {
  for (let i = 0; i + 1 < p.length; i++) {
    ok((romanRoot(p[i]) + 3) % 7 === romanRoot(p[i + 1]), `${key(p)}: ${p[i]} -> ${p[i + 1]} is not a fourth up`);
  }
}
ok(sessionScale.root >= 56 && sessionScale.root <= 60, 'home root is A-flat..C');

// --- Off: exactly ii-V-I-vi, home, 16 steps ---------------------------------------
for (let i = 0; i < RUNS; i++) {
  const h = nextHarmony('off');
  assert.deepStrictEqual(h.chords, [...PROGRESSION]);
  assert.strictEqual(h.rootShift, 0);
  assert.strictEqual(h.phraseSteps, 16);
}
checks++;

// --- Gentle and Drift ---------------------------------------------------------------
for (const mode of ['gentle', 'drift']) {
  setHarmonyMode(mode);
  const expectSteps = mode === 'gentle' ? 32 : 64;
  let last = null;
  let after; // last chord + shift, for the pivot
  let shift = 0;
  let moves = 0;
  let pivotMisses = 0;
  const seen = new Set();
  let at = 0;
  for (let i = 0; i < RUNS; i++) {
    const h = nextHarmony(mode, { last: last ?? undefined, after, at, barSec: BAR_SEC });
    ok(h.phraseSteps === expectSteps, `${mode}: phraseSteps ${h.phraseSteps}`);
    ok(last === null || key(h.chords) !== key(last), `${mode}: progression repeated back to back at run ${i}`);
    ok(PROGRESSION_POOL.some((p) => key(p) === key(h.chords)), `${mode}: progression is from the pool`);
    ok([0, 7, -7].includes(h.rootShift), `${mode}: rootShift ${h.rootShift}`);
    if (mode === 'gentle') ok(h.rootShift === 0, 'gentle never leaves home');
    // Every sounding root stays inside A-flat3 .. (C4 + 7) once folded upward.
    const sounding = sessionScale.root + foldShift(h.rootShift);
    ok(sounding >= 56 && sounding <= 67, `${mode}: sounding root ${sounding} out of range`);

    if (h.rootShift !== shift) {
      moves++;
      // Common-tone pivot: the first chord shares a tone with the chord we leave.
      const steps = sessionScale.steps;
      const pcs = (roman, s) => new Set(scale.chordDegrees(roman).map((d) => (Math.floor(d / 7) * 12 + steps[d % 7] + foldShift(s)) % 12));
      const leaving = pcs(after.chord, after.rootShift);
      if (![...pcs(h.chords[0], h.rootShift)].some((pc) => leaving.has(pc))) pivotMisses++;
      shift = h.rootShift;
    }
    seen.add(h.rootShift);
    last = h.chords;
    after = { chord: h.chords[h.chords.length - 1], rootShift: h.rootShift };
    at += h.chords.length * 2 * BAR_SEC;   // one cycle = chord every 2 bars
  }
  if (mode === 'drift') {
    ok(moves > 20, `drift: key moved ${moves} times`);
    ok(seen.has(0) && seen.has(7) && seen.has(-7), 'drift visits home, V and IV');
    ok(pivotMisses === 0, `drift: ${pivotMisses} key changes without a common tone`);
  } else {
    ok(moves === 0, 'gentle: no key change');
  }
}

// --- Drift: back home within 2 moves, moves 16..32 bars apart ----------------------
{
  setHarmonyMode('drift');
  const { keyShiftAt } = await import('../src/audio/music/harmony.ts');
  let shift = 0, at = 0, lastMoveAt = null, sinceHome = 0;
  const gaps = [];
  for (let i = 0; i < 200000; i++) {
    at += BAR_SEC;                      // one call per bar
    const s = keyShiftAt(at, BAR_SEC);
    if (s !== shift) {
      if (lastMoveAt !== null) gaps.push((at - lastMoveAt) / BAR_SEC);
      lastMoveAt = at;
      sinceHome = s === 0 ? 0 : sinceHome + 1;
      ok(sinceHome <= 1, 'drift: never more than one move away from home');
      ok(shift === 0 || s === 0, 'drift: away moves go straight home');
      shift = s;
    }
  }
  ok(gaps.length > 1000, 'drift: enough moves sampled');
  ok(Math.min(...gaps) >= 16 && Math.max(...gaps) <= 33, `drift: gaps ${Math.min(...gaps)}..${Math.max(...gaps)} bars`);
}

// --- Off through the cursor: ii V I vi every two bars, one-bar phrases ---------------
{
  setHarmonyMode('off');
  const cursor = makeHarmonyCursor(2);
  const romans = [];
  for (let bar = 0; bar < 16; bar++) {
    const b = cursor(bar, bar * BAR_SEC, BAR_SEC);
    ok(b.phraseBars === 1 && b.phraseBar === 0 && b.rootShift === 0 && b.mode === 'off', 'off cursor: one-bar phrase, home');
    if (b.roman) romans.push(b.roman);
    ok((bar % 2 === 0) === (b.roman !== null), 'off cursor: chord only on even bars');
  }
  assert.deepStrictEqual(romans, [...PROGRESSION, ...PROGRESSION]);
}

// --- Cursor in Drift: phrase bars cycle 0..3, chords change only on chord bars ------
{
  setHarmonyMode('drift');
  const cursor = makeHarmonyCursor(2);
  let prevPhraseBar = -1;
  for (let bar = 0; bar < 400; bar++) {
    const b = cursor(bar, bar * BAR_SEC, BAR_SEC);
    ok(b.phraseBars === 4, 'drift cursor: four-bar phrases');
    ok(prevPhraseBar < 0 || b.phraseBar === (prevPhraseBar + 1) % 4, 'drift cursor: phrase bars run in order');
    ok(bar % 2 === 0 || b.roman === null, 'drift cursor: no chord change mid-chord');
    prevPhraseBar = b.phraseBar;
  }
}

// --- Variation: second bar differs, step 0 stays, kicks keep two steps apart -------
{
  const kick = 'x.....x...x.....'.split('');
  for (let i = 0; i < RUNS; i++) {
    const v = varyCells(kick, (c) => c === 'x', 1, 2);
    ok(v[0] === 'x', 'variation keeps the downbeat');
    const hits = v.flatMap((c, k) => (c === 'x' ? [k] : []));
    ok(hits.every((h, k) => k === 0 || h - hits[k - 1] >= 2), 'variation keeps kick spacing');
    ok(v.filter((c) => c === 'x').length === 3, 'variation keeps the hit count');
  }
}

unregister();
console.log(`harmony-check OK (${checks} assertions)`);
