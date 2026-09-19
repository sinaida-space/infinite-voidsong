// Harmony switch (Off / Gentle / Drift). One function, nextHarmony(), decides
// the chords, the key and the phrase length for the next cycle; the music
// sources never decide any of that themselves. They read it through a cursor
// (makeHarmonyCursor) that calls nextHarmony() once per cycle, on a bar line.
//
//   Off     ii–V–I–vi, key at home, 16-step patterns: what the sources always did.
//   Gentle  a circle-of-fifths progression from the pool each cycle (never the
//           same one twice in a row), 32-step phrases.
//   Drift   as Gentle with 64-step phrases, and every 16 to 32 bars the tonic
//           moves a fifth up or a fourth up and, one move later, back home.
import type { HarmonyMode } from '../../state/types';
import { PROGRESSION, PROGRESSION_POOL, chordDegrees, foldShift, sessionScale, type Roman } from './scale';

export interface Harmony {
  chords: Roman[];              // the chords of one cycle, in order
  rootShift: number;            // semitones from the session root: 0 (home), +7 or -7
  phraseSteps: 16 | 32 | 64;    // length of the bass / arp / drum patterns in 16th steps
}

export interface NextHarmonyOpts {
  last?: readonly Roman[];                          // the caller's previous progression, so it never repeats back to back
  after?: { chord: Roman; rootShift: number };      // the caller's last chord: a key change starts on a chord that shares a tone with it
  at?: number;                                      // audio-clock time of the cycle start, seconds (the key moves on this clock, shared by all sources)
  barSec?: number;                                  // length of one bar for the caller, to turn "16 to 32 bars" into seconds
}

const PHRASE_STEPS: Record<HarmonyMode, 16 | 32 | 64> = { off: 16, gentle: 32, drift: 64 };
const MOVE_MIN_BARS = 16, MOVE_MAX_BARS = 32;   // time spent in a key before the next move
const DEFAULT_BAR_SEC = 3;                      // 4 beats at 80 bpm; used only when a caller passes no tempo

// --- shared state: the mode from the UI and the session's key --------------------

let mode: HarmonyMode = 'off';
const key = { shift: 0, nextMoveAt: null as number | null };
let lastPool = '';         // progression handed out last, for callers that pass no `last`
let virtualClock = 0;      // stands in for `at` when a caller passes none (the check script)

/** Set from the app state (AudioEngine.apply). Sources pick it up at their next cycle boundary. */
export function setHarmonyMode(next: HarmonyMode): void {
  mode = next;
  if (next !== 'drift') { key.shift = 0; key.nextMoveAt = null; }   // Off and Gentle never leave home
}
export const getHarmonyMode = (): HarmonyMode => mode;

/**
 * The key as of audio time `at`. In Drift, a move that is due happens here:
 * home -> V or IV (+7 / -7), away -> home. Each move is 16 to 32 bars after
 * the last, so the key is never more than one move from home.
 */
export function keyShiftAt(at: number, barSec = DEFAULT_BAR_SEC): number {
  return mode === 'drift' ? advanceKey(at, barSec) : 0;
}

function advanceKey(at: number, barSec: number): number {
  const bars = () => MOVE_MIN_BARS + Math.random() * (MOVE_MAX_BARS - MOVE_MIN_BARS);
  // A due time far beyond any legal gap means the caller's clock restarted: schedule afresh.
  if (key.nextMoveAt === null || key.nextMoveAt - at > MOVE_MAX_BARS * barSec * 3) key.nextMoveAt = at + bars() * barSec;
  else if (at >= key.nextMoveAt) {
    key.shift = key.shift === 0 ? (Math.random() < 0.5 ? 7 : -7) : 0;
    key.nextMoveAt = at + bars() * barSec;
  }
  return key.shift;
}

// Pitch classes of a 7th chord in the session mode, transposed by `shift`.
function chordPitchClasses(roman: Roman, shift: number): Set<number> {
  const steps = sessionScale.steps;
  const pcs = new Set<number>();
  for (const d of chordDegrees(roman)) {
    const semis = Math.floor(d / steps.length) * 12 + steps[d % steps.length];
    pcs.add((semis + foldShift(shift)) % 12);
  }
  return pcs;
}

/** The harmony for the next cycle. Off is a constant; Gentle and Drift draw from the pool. */
export function nextHarmony(harmonyMode: HarmonyMode, opts: NextHarmonyOpts = {}): Harmony {
  if (harmonyMode === 'off') return { chords: [...PROGRESSION], rootShift: 0, phraseSteps: 16 };

  const barSec = opts.barSec ?? DEFAULT_BAR_SEC;
  const at = opts.at ?? virtualClock;
  if (harmonyMode !== 'drift') { key.shift = 0; key.nextMoveAt = null; }
  const rootShift = harmonyMode === 'drift' ? advanceKey(at, barSec) : 0;

  const previous = opts.last ? opts.last.join(' ') : lastPool;
  let candidates = PROGRESSION_POOL.filter((p) => p.join(' ') !== previous);

  // Key change: begin on a chord that shares at least one tone with the chord we leave.
  const after = opts.after;
  if (after && foldShift(after.rootShift) !== foldShift(rootShift)) {
    const leaving = chordPitchClasses(after.chord, after.rootShift);
    const pivoted = candidates.filter((p) => [...chordPitchClasses(p[0], rootShift)].some((pc) => leaving.has(pc)));
    if (pivoted.length > 0) candidates = pivoted;
  }

  const chords = [...candidates[Math.floor(Math.random() * candidates.length)]];
  lastPool = chords.join(' ');
  virtualClock = at + chords.length * 2 * barSec;
  return { chords, rootShift, phraseSteps: PHRASE_STEPS[harmonyMode] };
}

// --- the cursor sources use ------------------------------------------------------

export interface BarHarmony {
  mode: HarmonyMode;        // the mode this cycle was drawn under
  roman: Roman | null;      // the chord that starts on this bar; null while the previous chord holds
  rootShift: number;        // semitones, snapshot for the whole cycle
  phraseBars: 1 | 2 | 4;    // pattern length in bars
  phraseBar: number;        // 0..phraseBars-1; 0 = a new phrase starts on this bar
}

/**
 * Per-source bookkeeping around nextHarmony(). Call the returned function at
 * the top of every bar with the bar counter, the bar's audio time and its
 * length in seconds. A new cycle (and with it a new progression, key and
 * phrase length) can only begin on a chord change, i.e. on a bar line, so a
 * key move never lands in the middle of a chord.
 */
export function makeHarmonyCursor(chordEveryBars: number): (bar: number, at: number, barSec: number) => BarHarmony {
  let cycle: Harmony = { chords: [], rootShift: 0, phraseSteps: 16 };
  let cycleMode: HarmonyMode = 'off';
  let index = -1;
  let phraseOrigin = 0;
  let lastChord: Roman | null = null;

  return (bar, at, barSec) => {
    let roman: Roman | null = null;
    if (bar % chordEveryBars === 0) {
      index++;
      if (index >= cycle.chords.length) {
        cycleMode = mode;
        const next = nextHarmony(cycleMode, {
          last: cycle.chords,
          after: lastChord ? { chord: lastChord, rootShift: cycle.rootShift } : undefined,
          at,
          barSec,
        });
        if (next.phraseSteps !== cycle.phraseSteps) phraseOrigin = bar;   // a new phrase length starts on the cycle line
        cycle = next;
        index = 0;
      }
      roman = cycle.chords[index];
      lastChord = roman;
    }
    const phraseBars = (cycle.phraseSteps / 16) as 1 | 2 | 4;
    const phraseBar = phraseBars === 1 ? 0 : (((bar - phraseOrigin) % phraseBars) + phraseBars) % phraseBars;
    return { mode: cycleMode, roman, rootShift: cycle.rootShift, phraseBars, phraseBar };
  };
}
