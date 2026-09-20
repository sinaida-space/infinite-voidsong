// Chillhop: the lofi recipe pushed further. A swung (62 %) 16th-note kit from
// a 4-pattern pool that never repeats a bar back to back, extended jazz
// chords (maj7 / min9 voicings) on a 3-op FM Rhodes every two bars, an
// upright-bass Karplus note on the chord root now and then, a vinyl bed of
// clicks and hiss, and a heavier tape. Rhodes and bass are sidechained to the kick.
import type { BarInfo, SequencedSource, SourceFactory } from '../music/types';
import { makeShell } from '../music/shell';
import { makeReverb } from '../music/reverb';
import { makeTape } from '../music/tape';
import { makeSidechain } from '../music/sidechain';
import { makeCrackle } from '../music/crackle';
import { karplusStrongBuffer } from '../music/buffers';
import { gridLane, pickDifferent } from '../music/grid';
import { hat, kick, snare, cleanupOnEnd } from '../music/hits';
import { chordDegrees, degreeToHz } from '../music/scale';
import { makeHarmonyCursor } from '../music/harmony';
import { drumPhrase } from '../music/phrase';
import { emitBeat } from '../music/beat';
import { clamp, dbToGain, rand } from '../music/util';

const DEFAULTS = { bpm: 72, tape: 0.6, pump: 0.4, crackle: 0.5 };
const SWING = 0.62;
const HAT_DROP_CHANCE = 0.15;
const CHORD_EVERY_BARS = 2;
const HAT_DB = -22;
const BASS_DB = -10;
const BASS_ON_CHORD_CHANCE = 0.7;    // a bass note under most chord changes
const BASS_ON_THREE_CHANCE = 0.3;    // and sometimes on beat 3
const BASS_SEC = 2;

// Pattern pool (kicks never closer than two steps: one eighth, so the
// sidechain recovery always finishes before the next dip).
interface Pattern { kick: string; snare: string; hat: string; }
const POOL: Pattern[] = [
  { kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  { kick: 'x.....x...x..x..', snare: '....x.......x...', hat: 'x.x.xxx.x.x.x.x.' },
  { kick: 'x.......x.x.....', snare: '....x......x..x.', hat: '.x.x.x.x.x.x.x.x' },
  { kick: 'x..x....x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.xxx.x.' },
];

// Voicings as offsets from the chord's four stacked thirds [r, r+2, r+4, r+6]
// plus the ninth (r+8): a plain 7th, a 9th with the third dropped, and a
// rootless 9th (the bass carries the root when it plays).
type Voicing = (degrees: number[]) => number[];
const VOICINGS: Voicing[] = [
  (d) => [d[0], d[1], d[2], d[3]],
  (d) => [d[0], d[2], d[3], d[0] + 8],
  (d) => [d[1], d[2], d[3], d[0] + 8],
];

interface RhodesNote { oscs: OscillatorNode[]; gains: GainNode[]; }

export const chillhop: SourceFactory = (ctx: AudioContext): SequencedSource => {
  const shell = makeShell(ctx, { level: 0.6, fadeIn: 2, fadeOut: 2 }, () => rhodesRelease(ctx.currentTime));
  const { bag, out } = shell;
  const params = { ...DEFAULTS };

  // Buses: drums -> tape; rhodes + bass -> sidechain -> tape; vinyl -> tape; tape -> out (+ reverb).
  const drumBus = bag.add(ctx.createGain());
  const sidechain = makeSidechain(ctx, bag);
  const tape = makeTape(ctx, bag, params.tape);
  const reverb = makeReverb(ctx, bag, 0.22);
  const crackle = makeCrackle(ctx, bag, shell.sched, () => shell.stopped, params.crackle);
  drumBus.connect(tape.input);
  sidechain.node.connect(tape.input);
  crackle.output.connect(tape.input);
  tape.output.connect(out);
  tape.output.connect(reverb.input);
  reverb.output.connect(out);

  // Bass: a plucked string on the root, low-passed at 400 Hz so it reads as
  // wood, not wire. The KS loss is higher (0.98) than the plucks source uses
  // because a low string has fewer periods per second and would ring too long.
  const bassLpf = bag.add(ctx.createBiquadFilter());
  bassLpf.type = 'lowpass';
  bassLpf.frequency.value = 400;
  bassLpf.connect(sidechain.node);
  const bass = (t: number, hz: number): void => {
    const src = ctx.createBufferSource();
    src.buffer = karplusStrongBuffer(ctx, hz, BASS_SEC, 0.98);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(dbToGain(BASS_DB), t + 0.01);
    src.connect(g).connect(bassLpf);
    src.start(t);
    src.stop(t + BASS_SEC);
    cleanupOnEnd(src, g);
  };

  // 3-op FM Rhodes: a sine carrier with two modulators. Op A at 1x the pitch
  // gives the body (index 0.9 falling to 0.15 over 1.5 s); op B at 14x is the
  // tine, a bright partial that dies within 150 ms. Held until release().
  let active: RhodesNote[] = [];
  const rhodesOn = (t: number, hz: number, vel: number): void => {
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = hz;
    const opA = ctx.createOscillator();
    opA.type = 'sine';
    opA.frequency.value = hz;
    const indexA = ctx.createGain();          // deviation in Hz = index * modulator frequency
    indexA.gain.setValueAtTime(hz * 0.9, t);
    indexA.gain.exponentialRampToValueAtTime(hz * 0.15, t + 1.5);
    const opB = ctx.createOscillator();
    opB.type = 'sine';
    opB.frequency.value = hz * 14;
    const indexB = ctx.createGain();
    indexB.gain.setValueAtTime(hz * 14 * 0.12, t);
    indexB.gain.exponentialRampToValueAtTime(hz * 0.01, t + 0.15);
    opA.connect(indexA).connect(carrier.frequency);
    opB.connect(indexB).connect(carrier.frequency);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(vel, t + 0.02);
    amp.gain.exponentialRampToValueAtTime(vel * 0.3, t + 1.5);
    carrier.connect(amp).connect(sidechain.node);
    for (const o of [carrier, opA, opB]) o.start(t);
    active.push({ oscs: [carrier, opA, opB], gains: [amp, indexA, indexB] });
  };
  const rhodesRelease = (t: number): void => {
    for (const n of active) {
      const amp = n.gains[0].gain;
      amp.cancelScheduledValues(t);
      amp.setValueAtTime(amp.value, t);
      amp.linearRampToValueAtTime(0, t + 0.5);
      for (const o of n.oscs) o.stop(t + 0.55);
      n.oscs[0].onended = () => { for (const o of n.oscs) o.disconnect(); for (const g of n.gains) g.disconnect(); };
    }
    active = [];
  };

  // Sequencer state.
  let lastPattern = -1;
  let current: Pattern = POOL[0];
  let phrase: Pattern[] = [];       // Harmony Gentle / Drift: the bars of the current phrase (one bar when Off)
  const harmony = makeHarmonyCursor(CHORD_EVERY_BARS);
  let rootHz = degreeToHz(-14);
  let started = false;

  const beginBar = (t: number, bar: number, bpm: number): void => {
    const h = harmony(bar, t, (60 / bpm) * 4);
    // A new pattern each bar (Off), each two bars (Gentle) or each four bars (Drift); never the same twice in a row.
    if (h.phraseBar === 0) {
      lastPattern = pickDifferent(POOL.length, lastPattern);
      phrase = drumPhrase(POOL[lastPattern], h.phraseBars);
    }
    const p = phrase[h.phraseBar];
    const hats = p.hat.split('').map((c) => (c === 'x' && Math.random() < HAT_DROP_CHANCE ? '.' : c)).join('');
    current = { kick: p.kick, snare: p.snare, hat: hats };

    let chord: string | null = null;
    if (h.roman) {
      chord = h.roman;
      const degrees = chordDegrees(h.roman);
      rootHz = degreeToHz(degrees[0] - 14, undefined, h.rootShift);   // two octaves under the chord root
      rhodesRelease(t);
      const voicing = VOICINGS[Math.floor(rand(0, VOICINGS.length))](degrees);
      // Voiced an octave below the root register; notes spread over 25 ms like a hand, not a stamp.
      for (const d of voicing) rhodesOn(t + rand(0, 0.025), degreeToHz(d - 7, undefined, h.rootShift), rand(0.12, 0.18));
      if (Math.random() < BASS_ON_CHORD_CHANCE) bass(t, rootHz);
    }
    const info: BarInfo = { bar, time: t, bpm, pattern: lastPattern, chord, signature: `${current.kick}|${current.snare}|${current.hat}` };
    source.onBar?.(info);
  };

  const step = (t: number, s: number): void => {
    if (current.kick[s] === 'x') {
      kick(ctx, drumBus, t, { startHz: 110, endHz: 55, dropSec: 0.04, decaySec: 0.3, level: 0.85 });
      sidechain.duck(t, params.pump);
      emitBeat(t);
      source.onBeat?.(t);
    }
    if (current.snare[s] === 'x') snare(ctx, drumBus, t, 0.5);
    if (current.hat[s] === 'x') hat(ctx, drumBus, t, { hpfHz: 8000, sec: 0.04, level: dbToGain(HAT_DB) * (s % 4 === 0 ? rand(0.8, 1) : rand(0.4, 0.7)) });
    if (s === 8 && Math.random() < BASS_ON_THREE_CHANCE) bass(t, rootHz);
  };

  const lane = gridLane({ swing: SWING, bpm: () => params.bpm, stopped: () => shell.stopped, beginBar, step });

  const source: SequencedSource = {
    id: 'chillhop',
    family: 'music',
    onBeat: null,
    onBar: null,
    connect(dest) { out.connect(dest); },
    start(at) {
      if (started) return;
      started = true;
      const t = Math.max(at, ctx.currentTime);
      shell.start(t);
      crackle.start(t);
      shell.sched.add(t + 0.05, lane);
    },
    stop(at) { shell.stop(at); },
    setParam(key, value, rampSec) {
      if (key === 'chillhop.bpm') params.bpm = clamp(value, 60, 90);
      else if (key === 'chillhop.tape') { params.tape = clamp(value, 0, 1); tape.setAmount(params.tape, ctx.currentTime, rampSec); }
      else if (key === 'chillhop.pump') params.pump = clamp(value, 0, 1);
      else if (key === 'chillhop.crackle') { params.crackle = clamp(value, 0, 1); crackle.setAmount(params.crackle, ctx.currentTime, rampSec); }
    },
    dispose() { shell.dispose(); },
  };
  return source;
};
