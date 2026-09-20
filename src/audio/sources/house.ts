// House: four-on-the-floor kick, open hat on the off-beats, clap on 2 and 4,
// a sub bass on the off-beats following the chord root, and filtered saw
// stabs on a 2-bar pattern from a 4-pattern pool (never the same pattern
// twice in a row). Chords walk ii–V–I–vi every four bars. Stabs and sub are
// sidechained to the kick; the whole mix runs through a slow low-pass sweep
// (the `house.filter` knob) and then the tape.
import type { BarInfo, SequencedSource, SourceFactory } from '../music/types';
import { makeShell } from '../music/shell';
import { makeReverb } from '../music/reverb';
import { makeTape } from '../music/tape';
import { makeSidechain } from '../music/sidechain';
import { gridLane, pickDifferent, STEPS } from '../music/grid';
import { clap, hat, kick, cleanupOnEnd } from '../music/hits';
import { chordDegrees, degreeToHz } from '../music/scale';
import { makeHarmonyCursor } from '../music/harmony';
import { varyCells } from '../music/phrase';
import { emitBeat } from '../music/beat';
import { clamp, dbToGain, rand, rampHz } from '../music/util';

const DEFAULTS = { bpm: 100, tape: 0.2, pump: 0.5, filter: 0.4 };
const CHORD_EVERY_BARS = 4;
const OPEN_HAT_DB = -16;
const CLAP_DB = -14;
const STAB_DB = -12;               // per saw; four of them make the stab
const STAB_SEC = 0.2;
const SUB_LEVEL = 0.5;
const EXTRA_KICK_CHANCE = 0.12;    // a pickup on the "and of 4": still an eighth (>= 272 ms at 110 bpm) before the next kick
const SWEEP_PERIOD_SEC = 50;       // one full filter sweep
const SWEEP_TICK_SEC = 0.25;       // the sweep lane re-aims the cutoff this often
const SWEEP_TOP_HZ = 8000, SWEEP_BOTTOM_HZ = 800;

// Stab patterns: 32 steps = two bars. Every half is different from every other
// half in the pool, so two consecutive bars never carry the same stab pattern.
const STAB_POOL: string[] = [
  'x.....x...x.....' + '....x.....x...x.',
  '..x...x...x...x.' + 'x.....x.......x.',
  'x..x..x...x..x..' + '..x...x.x.......',
  '.x..x..x..x..x..' + 'x...x...x..x....',
];

export const house: SourceFactory = (ctx: AudioContext): SequencedSource => {
  const shell = makeShell(ctx, { level: 0.6, fadeIn: 2, fadeOut: 2 });
  const { bag, out } = shell;
  const params = { ...DEFAULTS };

  // Buses: drums -> sweep; stabs + sub -> sidechain -> sweep; sweep -> tape -> out (+ reverb).
  const drumBus = bag.add(ctx.createGain());
  const sidechain = makeSidechain(ctx, bag);
  const sweep = bag.add(ctx.createBiquadFilter());
  sweep.type = 'lowpass';
  sweep.frequency.value = SWEEP_TOP_HZ;
  sweep.Q.value = 1.2;   // a little resonance so the sweep is audible as a sweep
  const tape = makeTape(ctx, bag, params.tape);
  const reverb = makeReverb(ctx, bag, 0.15);
  drumBus.connect(sweep);
  sidechain.node.connect(sweep);
  sweep.connect(tape.input);
  tape.output.connect(out);
  tape.output.connect(reverb.input);
  reverb.output.connect(out);

  // Stab: four saws on the chord tones through a 1.8 kHz low-pass, 200 ms envelope.
  const stab = (t: number, hzs: number[]): void => {
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 1800;
    lpf.Q.value = 1;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(dbToGain(STAB_DB), t + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.001, t + STAB_SEC);
    lpf.connect(amp).connect(sidechain.node);
    hzs.forEach((hz, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.detune.value = rand(-4, 4);
      o.connect(lpf);
      o.start(t);
      o.stop(t + STAB_SEC + 0.02);
      if (i === 0) cleanupOnEnd(o, lpf, amp); else cleanupOnEnd(o);
    });
  };

  // Sub: a sine on the chord root two octaves down, 5 ms attack, 250 ms decay.
  const sub = (t: number, hz: number): void => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(SUB_LEVEL, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(sidechain.node);
    o.start(t);
    o.stop(t + 0.27);
    cleanupOnEnd(o, g);
  };

  // Sequencer state.
  let lastPattern = -1;
  let pattern = STAB_POOL[0];
  let half = 0;                         // which bar of the 2-bar pattern (Harmony Off)
  let stabBar = '';                     // the stab pattern of the current bar, 16 steps
  let phrase: string[] = [];            // Harmony Gentle / Drift: the stab bars of the current phrase
  const harmony = makeHarmonyCursor(CHORD_EVERY_BARS);
  let hatDrops = '';                    // per-bar open-hat humanising
  let extraKick = false;
  let stabHz: number[] = [];
  let subHz = 55;
  let started = false;

  const beginBar = (t: number, bar: number, bpm: number): void => {
    const h = harmony(bar, t, (60 / bpm) * 4);
    if (h.mode === 'off') {
      if (bar % 2 === 0) { lastPattern = pickDifferent(STAB_POOL.length, lastPattern); pattern = STAB_POOL[lastPattern]; }
      half = bar % 2;
      stabBar = pattern.slice(half * STEPS, half * STEPS + STEPS);
    } else {
      // Gentle: the two bars of a pool pattern. Drift: four bars, A A' A B with B the second bar pushed further.
      if (h.phraseBar === 0) {
        lastPattern = pickDifferent(STAB_POOL.length, lastPattern);
        pattern = STAB_POOL[lastPattern];
        const a = pattern.slice(0, STEPS), b = pattern.slice(STEPS);
        const vary = (bar16: string, ops: number): string => varyCells(bar16.split(''), (c) => c === 'x', ops).join('');
        phrase = h.phraseBars === 2 ? [a, b] : [a, b, a, vary(b, 3)];
      }
      stabBar = phrase[h.phraseBar];
    }
    hatDrops = '..x...x...x...x.'.split('').map((c) => (c === 'x' && Math.random() < 0.08 ? '.' : c)).join('');
    extraKick = Math.random() < EXTRA_KICK_CHANCE;

    let chord: string | null = null;
    if (h.roman) {
      chord = h.roman;
      const degrees = chordDegrees(h.roman);
      stabHz = degrees.map((d) => degreeToHz(d, undefined, h.rootShift));
      // Two octaves under the chord root; anything below 45 Hz comes up an octave so it stays a note, not a rumble.
      subHz = degreeToHz(degrees[0] - 14, undefined, h.rootShift);
      if (subHz < 45) subHz *= 2;
    }
    const signature = `${stabBar}|${hatDrops}|${extraKick ? 'k' : '-'}`;
    const info: BarInfo = { bar, time: t, bpm, pattern: lastPattern, chord, signature };
    source.onBar?.(info);
  };

  const step = (t: number, s: number): void => {
    if (s % 4 === 0 || (s === 14 && extraKick)) {
      kick(ctx, drumBus, t, { startHz: 150, endHz: 55, dropSec: 0.045, decaySec: 0.3, level: 0.9 });
      sidechain.duck(t, params.pump);
      emitBeat(t);
      source.onBeat?.(t);
    }
    if (hatDrops[s] === 'x') hat(ctx, drumBus, t, { hpfHz: 6000, sec: 0.12, level: dbToGain(OPEN_HAT_DB) * rand(0.85, 1) });
    if (s === 4 || s === 12) clap(ctx, drumBus, t, dbToGain(CLAP_DB));
    if (s % 4 === 2) sub(t, subHz);
    if (stabBar[s] === 'x') stab(t, stabHz);
  };

  // Filter sweep lane: every 250 ms aim the cutoff at a point on a slow sine.
  // amount 0 holds 8 kHz; amount 1 sweeps the full 800 Hz .. 8 kHz range on a
  // log scale, so the middle of the knob still moves through the mids.
  let sweepT0 = 0;
  const sweepLane = (t: number): number | null => {
    if (shell.stopped) return null;
    const phase = (t - sweepT0) / SWEEP_PERIOD_SEC * 2 * Math.PI;
    const depth = params.filter * (0.5 - 0.5 * Math.cos(phase));   // 0 at the top, params.filter at the bottom
    const hz = SWEEP_TOP_HZ * Math.pow(SWEEP_BOTTOM_HZ / SWEEP_TOP_HZ, depth);
    rampHz(sweep.frequency, hz, t, SWEEP_TICK_SEC);
    return t + SWEEP_TICK_SEC;
  };

  const lane = gridLane({ swing: 0.5, bpm: () => params.bpm, stopped: () => shell.stopped, beginBar, step });

  const source: SequencedSource = {
    id: 'house',
    family: 'music',
    onBeat: null,
    onBar: null,
    connect(dest) { out.connect(dest); },
    start(at) {
      if (started) return;
      started = true;
      const t = Math.max(at, ctx.currentTime);
      shell.start(t);
      sweepT0 = t;
      shell.sched.add(t + 0.05, lane);
      shell.sched.add(t + 0.05, sweepLane);
    },
    stop(at) { shell.stop(at); },
    setParam(key, value, rampSec) {
      if (key === 'house.bpm') params.bpm = clamp(value, 90, 110);
      else if (key === 'house.tape') { params.tape = clamp(value, 0, 1); tape.setAmount(params.tape, ctx.currentTime, rampSec); }
      else if (key === 'house.pump') params.pump = clamp(value, 0, 1);
      else if (key === 'house.filter') params.filter = clamp(value, 0, 1);   // picked up by the next sweep tick
    },
    dispose() { shell.dispose(); },
  };
  return source;
};
