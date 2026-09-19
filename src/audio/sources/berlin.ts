// Berlin: a Berlin-school sequence with no drums. A mono saw + square voice
// plays a 16-step line on the session pentatonic; a second line an octave up
// runs at half speed 8 dB lower. Both go through one resonant low-pass whose
// cutoff drifts on a very slow LFO (one sweep every 20–50 s), then a 3/16
// ping-pong delay and the tape. One step of one line mutates every 4–8 bars,
// so the pattern is always recognisable and never quite the same.
import type { BarInfo, SequencedSource, SourceFactory } from '../music/types';
import { makeShell } from '../music/shell';
import { makeReverb } from '../music/reverb';
import { makeTape } from '../music/tape';
import { makePingPong } from '../music/pingpong';
import { gridLane, STEPS } from '../music/grid';
import { noiseBurst, cleanupOnEnd } from '../music/hits';
import { degreeToHz, sessionScale } from '../music/scale';
import { makeHarmonyCursor } from '../music/harmony';
import { linePhrase, varyLine } from '../music/phrase';
import { emitBeat } from '../music/beat';
import { clamp, dbToGain, ramp, rand } from '../music/util';

const DEFAULTS = { bpm: 84, tape: 0.4, pulse: 0.3 };
const GATE = 0.5;                  // the voice sounds for half of each step
const LOW_DB = -6;                 // main line level into the filter
const HIGH_DB = LOW_DB - 8;        // the octave line, 8 dB under it
const REST_CHANCE = 0.25;          // holes in a fresh line
const MUTATE_MIN_BARS = 4, MUTATE_MAX_BARS = 8;
const LFO_HZ_MIN = 0.02, LFO_HZ_MAX = 0.05;
const CUTOFF_MID_HZ = 1300, CUTOFF_SWING_HZ = 1000;   // the LFO sweeps 300 Hz .. 2.3 kHz
const RESONANCE_MIN = 3, RESONANCE_MAX = 6;
const DELAY_STEPS = 3;             // 3/16 of a bar
const PULSE_DB = -24;

// A step is a scale degree on the pentatonic (index into a two-octave pool) or a rest.
type Line = (number | null)[];

export const berlin: SourceFactory = (ctx: AudioContext): SequencedSource => {
  const shell = makeShell(ctx, { level: 0.26, fadeIn: 3, fadeOut: 3 });   // resonant saws are loud: trimmed to sit with lofi
  const { bag, out } = shell;
  const params = { ...DEFAULTS };

  // Note pool: the pentatonic across two octaves, from the octave below the
  // session root. Both modes' pentatonic already carry the fifth (7 semitones),
  // and mutations lean on it (see mutate), so lines rest on root/fifth pillars.
  const penta = sessionScale.pentatonic;
  const POOL_SIZE = penta.length * 2;
  let keyShift = 0;   // Harmony Drift: semitones from the session root, set on a bar line
  const poolHz = (i: number, octaveUp: number): number => {
    const octave = Math.floor(i / penta.length) - 1 + octaveUp;
    return degreeToHz(octave * penta.length + (i % penta.length), penta, keyShift);
  };
  const FIFTH_INDEX = penta.indexOf(7);   // 3 in Dorian, 3 in Lydian

  // Buses: voices -> filter -> delay + dry -> tape -> out (+ reverb); pulse -> tape.
  const filter = bag.add(ctx.createBiquadFilter());
  filter.type = 'lowpass';
  filter.frequency.value = CUTOFF_MID_HZ;
  filter.Q.value = rand(RESONANCE_MIN, RESONANCE_MAX);
  const lfo = bag.add(ctx.createOscillator());
  lfo.type = 'sine';
  lfo.frequency.value = rand(LFO_HZ_MIN, LFO_HZ_MAX);
  const lfoDepth = bag.add(ctx.createGain());
  lfoDepth.gain.value = CUTOFF_SWING_HZ;
  lfo.connect(lfoDepth).connect(filter.frequency);

  const sixteenthSec = (bpm: number): number => 60 / bpm / 4;
  const delay = makePingPong(ctx, bag, sixteenthSec(params.bpm) * DELAY_STEPS, 0.3, 0.35);
  const tape = makeTape(ctx, bag, params.tape);
  const reverb = makeReverb(ctx, bag, 0.25);
  filter.connect(tape.input);
  filter.connect(delay.input);
  delay.output.connect(tape.input);
  tape.output.connect(out);
  tape.output.connect(reverb.input);
  reverb.output.connect(out);

  const pulseBus = bag.add(ctx.createGain());
  pulseBus.gain.value = dbToGain(PULSE_DB) * params.pulse;
  pulseBus.connect(tape.input);

  // A mono voice: one saw and one square on the same pitch into a VCA that
  // the sequencer gates. Persistent nodes; only the frequency and the gate move.
  interface Voice { saw: OscillatorNode; square: OscillatorNode; vca: GainNode; }
  const makeVoice = (db: number): Voice => {
    const saw = bag.add(ctx.createOscillator());
    saw.type = 'sawtooth';
    const square = bag.add(ctx.createOscillator());
    square.type = 'square';
    const squareTrim = bag.add(ctx.createGain());
    squareTrim.gain.value = 0.5;   // the square sits under the saw
    const vca = bag.add(ctx.createGain());
    vca.gain.value = 0;
    const level = bag.add(ctx.createGain());
    level.gain.value = dbToGain(db);
    saw.connect(vca);
    square.connect(squareTrim).connect(vca);
    vca.connect(level).connect(filter);
    return { saw, square, vca };
  };
  const low = makeVoice(LOW_DB);
  const high = makeVoice(HIGH_DB);

  // Gate a voice at `t` for `sec`: pitch is set while the VCA is closed, then
  // a 3 ms attack, hold to the gate length, 15 ms release.
  const gateVoice = (v: Voice, t: number, hz: number, sec: number): void => {
    v.saw.frequency.setValueAtTime(hz, t);
    v.square.frequency.setValueAtTime(hz, t);
    const g = v.vca.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(1, t + 0.003);
    g.setValueAtTime(1, t + sec * GATE);
    g.linearRampToValueAtTime(0, t + sec * GATE + 0.015);
  };

  // Soft pulse: 12 ms of noise through a band-pass at 1.5 kHz, i.e. a filtered click.
  const pulse = (t: number): void => {
    const burst = noiseBurst(ctx, t, 0.012);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 1500;
    bpf.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    burst.connect(bpf).connect(g).connect(pulseBus);
    cleanupOnEnd(burst, bpf, g);
  };

  // Lines. A fresh line is random pool indices with some rests; the first step
  // is always the root so the sequence has a downbeat.
  const freshLine = (): Line => {
    const line: Line = [];
    for (let i = 0; i < STEPS; i++) line.push(Math.random() < REST_CHANCE ? null : Math.floor(rand(0, POOL_SIZE)));
    line[0] = penta.length;   // root, upper octave of the pool
    return line;
  };
  const lowLine = freshLine();
  const highLine = freshLine();
  // Mutate exactly one step of one line: to the fifth (40 %), a rest (15 %) or any pool note.
  const mutate = (): void => {
    const line = Math.random() < 0.6 ? lowLine : highLine;
    const i = Math.floor(rand(0, STEPS));
    const r = Math.random();
    line[i] = r < 0.4 ? FIFTH_INDEX + (Math.random() < 0.5 ? 0 : penta.length)
      : r < 0.55 ? null
      : Math.floor(rand(0, POOL_SIZE));
  };

  let barsToMutation = Math.floor(rand(MUTATE_MIN_BARS, MUTATE_MAX_BARS + 1));
  let highStep = 0;      // the octave line advances every second 16th
  // Harmony Off plays the two 16-step lines as they are. Gentle turns the low line into a
  // two-bar phrase and Drift into four bars (A A' A B); Drift also stretches the octave line
  // to 32 notes. The lines above stay the source and keep mutating; a phrase is rebuilt
  // from them every time it starts.
  const harmony = makeHarmonyCursor(2);
  let lowPhrase: Line[] = [];
  let lowBar: Line = lowLine;
  let highCells: Line = highLine;
  let barBpm = params.bpm;
  let started = false;

  const beginBar = (t: number, bar: number, bpm: number): void => {
    if (bpm !== barBpm) delay.setTime(sixteenthSec(bpm) * DELAY_STEPS, t, 0.3);
    barBpm = bpm;
    if (--barsToMutation <= 0) {
      mutate();
      barsToMutation = Math.floor(rand(MUTATE_MIN_BARS, MUTATE_MAX_BARS + 1));
    }
    const h = harmony(bar, t, (60 / bpm) * 4);
    keyShift = h.rootShift;
    if (h.mode === 'off') {
      lowBar = lowLine;
      highCells = highLine;
    } else {
      if (h.phraseBar === 0) {
        lowPhrase = linePhrase(lowLine, h.phraseBars);
        highCells = h.phraseBars === 4 ? [...highLine, ...varyLine(highLine, 3)] : highLine;
        highStep = 0;   // the octave line restarts with the phrase so both stay aligned
      }
      lowBar = lowPhrase[h.phraseBar];
    }
    const show = (l: Line) => l.map((v) => (v === null ? '.' : v)).join(',');
    const info: BarInfo = { bar, time: t, bpm, pattern: 0, chord: null, signature: `${show(lowBar)}|${show(highCells)}` };
    source.onBar?.(info);
  };

  const step = (t: number, s: number): void => {
    const sec = sixteenthSec(barBpm);
    const n = lowBar[s];
    if (n !== null) gateVoice(low, t, poolHz(n, 0), sec);
    if (s % 2 === 0) {
      // Half speed: the high line reads one step per eighth and holds for two 16ths.
      const h = highCells[highStep % highCells.length];
      if (h !== null) gateVoice(high, t, poolHz(h, 1), sec * 2);
      highStep = (highStep + 1) % (STEPS * 4);
      if (params.pulse > 0.01) pulse(t);
      // The beat meter follows the quarter-note pulse; silent pulse, no beat.
      if (s % 4 === 0 && params.pulse > 0.05) { emitBeat(t); source.onBeat?.(t); }
    }
  };

  const lane = gridLane({ swing: 0.5, bpm: () => params.bpm, stopped: () => shell.stopped, beginBar, step });

  const source: SequencedSource = {
    id: 'berlin',
    family: 'music',
    onBeat: null,
    onBar: null,
    connect(dest) { out.connect(dest); },
    start(at) {
      if (started) return;
      started = true;
      const t = Math.max(at, ctx.currentTime);
      lfo.start(t);
      for (const v of [low, high]) { v.saw.start(t); v.square.start(t); }
      shell.start(t);
      shell.sched.add(t + 0.05, lane);
    },
    stop(at) { shell.stop(at); },
    setParam(key, value, rampSec) {
      if (key === 'berlin.bpm') params.bpm = clamp(value, 70, 100);
      else if (key === 'berlin.tape') { params.tape = clamp(value, 0, 1); tape.setAmount(params.tape, ctx.currentTime, rampSec); }
      else if (key === 'berlin.pulse') { params.pulse = clamp(value, 0, 1); ramp(pulseBus.gain, dbToGain(PULSE_DB) * params.pulse, ctx.currentTime, rampSec); }
    },
    dispose() { shell.dispose(); },
  };
  return source;
};
