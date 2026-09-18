// Synthwave: a 16th-note arpeggiated saw bass from a 4-pattern pool (never the
// same pattern twice in a row), detuned saw + square pads on i–VI–III–VII
// moving every two bars with a 2 s crossfade, a chorus on the pads, and an
// 80s drum kit: kick on 1 and 3, gated snare on 2 and 4, closed hats on 8ths.
// Pads and bass are sidechained to the kick; everything runs through the tape.
import type { BarInfo, SequencedSource, SourceFactory } from '../music/types';
import { makeShell } from '../music/shell';
import { makeReverb } from '../music/reverb';
import { makeTape } from '../music/tape';
import { makeSidechain } from '../music/sidechain';
import { makeChorus } from '../music/chorus';
import { gridLane, pickDifferent } from '../music/grid';
import { gatedSnare, hat, kick, cleanupOnEnd } from '../music/hits';
import { degreeToHz } from '../music/scale';
import { emitBeat } from '../music/beat';
import { clamp, dbToGain, rand } from '../music/util';

const DEFAULTS = { bpm: 92, tape: 0.3, pump: 0.35, arp: 0.5 };
const CHORD_EVERY_BARS = 2;
const PAD_XFADE_SEC = 2;
const EXTRA_KICK_CHANCE = 0.2;     // a pickup kick on the "and of 4" now and then
const HAT_DB = -18;
const PAD_DB = -16;                // per oscillator; nine of them sum to a bed, not a lead

// Chord cycle i–VI–III–VII as scale-degree roots; each chord is a triad
// stacked in thirds from the session scale, so it is minor in Dorian and
// major-leaning in Lydian without a separate table.
const CYCLE: { roman: string; root: number }[] = [
  { roman: 'i', root: 0 }, { roman: 'VI', root: 5 }, { roman: 'III', root: 2 }, { roman: 'VII', root: 6 },
];

// Arpeggio pool: semitone offsets above the chord root in the bass octave
// (0 = root, 7 = fifth, 12 = octave), one entry per 16th; null = rest.
type Arp = (number | null)[];
const ARPS: Arp[] = [
  [0, 0, 12, 0, 0, 0, 12, 7, 0, 0, 12, 0, 0, 7, 12, 7],
  [0, 12, 0, 12, 0, 12, 7, 12, 0, 12, 0, 12, 0, 12, 7, 12],
  [0, 0, 7, 0, 12, 0, 7, 0, 0, 0, 7, 0, 12, 7, 0, 7],
  [0, 7, 12, 7, 0, 7, 12, 7, 0, 7, 12, 0, 0, 7, 12, null],
];

interface PadNote { oscs: OscillatorNode[]; amp: GainNode; }

export const synthwave: SourceFactory = (ctx: AudioContext): SequencedSource => {
  const shell = makeShell(ctx, { level: 0.38, fadeIn: 2, fadeOut: 2 }, () => padRelease(ctx.currentTime, 0.4));   // trimmed to sit with lofi
  const { bag, out } = shell;
  const params = { ...DEFAULTS };

  // Buses: drums -> tape; pads -> chorus -> sidechain; arp -> sidechain; sidechain -> tape; tape -> out (+ reverb).
  const drumBus = bag.add(ctx.createGain());
  const sidechain = makeSidechain(ctx, bag);
  const tape = makeTape(ctx, bag, params.tape);
  const reverb = makeReverb(ctx, bag, 0.18);
  drumBus.connect(tape.input);
  sidechain.node.connect(tape.input);
  tape.output.connect(out);
  tape.output.connect(reverb.input);
  reverb.output.connect(out);

  // Pads: low-pass at 2 kHz (the saws are bright), then the chorus for width.
  const padFilter = bag.add(ctx.createBiquadFilter());
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 2000;
  padFilter.Q.value = 0.7;
  const chorus = makeChorus(ctx, bag);
  const padTrim = bag.add(ctx.createGain());
  padTrim.gain.value = 0.7;   // the chorus adds two taps at half level; this brings the sum back down
  padFilter.connect(chorus.input);
  chorus.output.connect(padTrim).connect(sidechain.node);

  // Arp bass filter: base cutoff 600 Hz (arp 0) to 1400 Hz (arp 1); each note
  // opens it to 2.5x the base and lets it fall back over 100 ms.
  const arpBase = (): number => 600 + 800 * params.arp;
  const arpBus = bag.add(ctx.createGain());
  arpBus.connect(sidechain.node);

  // One arp note: two saws detuned ±5 cents -> low-pass with its own envelope -> amp.
  const arpNote = (t: number, hz: number, sec: number): void => {
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.Q.value = 2;
    const base = arpBase();
    lpf.frequency.setValueAtTime(base * 2.5, t);
    lpf.frequency.exponentialRampToValueAtTime(base, t + 0.1);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.16, t + 0.004);
    amp.gain.setValueAtTime(0.16, t + sec * 0.55);
    amp.gain.linearRampToValueAtTime(0, t + sec * 0.55 + 0.03);
    lpf.connect(amp).connect(arpBus);
    const oscs = [5, -5].map((cents) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.detune.value = cents;
      o.connect(lpf);
      o.start(t);
      o.stop(t + sec * 0.55 + 0.05);
      return o;
    });
    cleanupOnEnd(oscs[0], lpf, amp);
    cleanupOnEnd(oscs[1]);
  };

  // Pad chord: per note two saws at ±8 cents and a square an octave up 9 dB
  // lower, all fading in over the crossfade time. Held until padRelease().
  let held: PadNote[] = [];
  const padOn = (t: number, hz: number): void => {
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(dbToGain(PAD_DB), t + PAD_XFADE_SEC);
    amp.connect(padFilter);
    const specs: { type: OscillatorType; mul: number; cents: number; db: number }[] = [
      { type: 'sawtooth', mul: 1, cents: 8, db: 0 },
      { type: 'sawtooth', mul: 1, cents: -8, db: 0 },
      { type: 'square', mul: 2, cents: 0, db: -9 },
    ];
    const oscs = specs.map((s) => {
      const o = ctx.createOscillator();
      o.type = s.type;
      o.frequency.value = hz * s.mul;
      o.detune.value = s.cents;
      const g = ctx.createGain();
      g.gain.value = dbToGain(s.db);
      o.connect(g).connect(amp);
      o.start(t);
      o.onended = () => { o.disconnect(); g.disconnect(); };
      return o;
    });
    held.push({ oscs, amp });
  };
  const padRelease = (t: number, sec: number): void => {
    for (const n of held) {
      n.amp.gain.cancelScheduledValues(t);
      n.amp.gain.setValueAtTime(n.amp.gain.value, t);
      n.amp.gain.linearRampToValueAtTime(0, t + sec);
      for (const o of n.oscs) o.stop(t + sec + 0.05);
      n.oscs[0].addEventListener('ended', () => n.amp.disconnect());
    }
    held = [];
  };

  // Sequencer state.
  let lastArp = -1;
  let arp: Arp = ARPS[0];
  let hats = '';
  let extraKick = false;
  let chordIndex = -1;
  let chordRootHz = degreeToHz(-7);   // bass octave below the session root
  let barBpm = params.bpm;
  let started = false;

  const beginBar = (t: number, bar: number, bpm: number): void => {
    barBpm = bpm;
    lastArp = pickDifferent(ARPS.length, lastArp);
    arp = ARPS[lastArp];
    // Hats on every 8th; each bar drops one or two at random so the ride breathes.
    hats = 'x.x.x.x.x.x.x.x.'.split('').map((c) => (c === 'x' && Math.random() < 0.1 ? '.' : c)).join('');
    extraKick = Math.random() < EXTRA_KICK_CHANCE;

    let chord: string | null = null;
    if (bar % CHORD_EVERY_BARS === 0) {
      chordIndex = (chordIndex + 1) % CYCLE.length;
      const c = CYCLE[chordIndex];
      chord = c.roman;
      chordRootHz = degreeToHz(c.root - 7);
      padRelease(t, PAD_XFADE_SEC);
      for (const d of [c.root, c.root + 2, c.root + 4]) padOn(t, degreeToHz(d));
    }
    const signature = `${arp.map((v) => (v === null ? '.' : v)).join(',')}|${hats}|${extraKick ? 'k' : '-'}`;
    source.onBar?.({ bar, time: t, bpm, pattern: lastArp, chord, signature } satisfies BarInfo);
  };

  const step = (t: number, s: number): void => {
    const sixteenth = 60 / barBpm / 4;
    // Kick on 1 and 3 (steps 0, 8); the optional pickup on step 14 is still an eighth before the next downbeat.
    if (s === 0 || s === 8 || (s === 14 && extraKick)) {
      kick(ctx, drumBus, t, { startHz: 120, endHz: 55, dropSec: 0.04, decaySec: 0.35, level: 0.9 });
      sidechain.duck(t, params.pump);
      emitBeat(t);
      source.onBeat?.(t);
    }
    if (s === 4 || s === 12) gatedSnare(ctx, drumBus, reverb.input, t, 0.5);
    if (hats[s] === 'x') hat(ctx, drumBus, t, { hpfHz: 8000, sec: 0.04, level: dbToGain(HAT_DB) * rand(0.8, 1) });
    const offset = arp[s];
    if (offset !== null) arpNote(t, chordRootHz * Math.pow(2, offset / 12), sixteenth);
  };

  const lane = gridLane({ swing: 0.5, bpm: () => params.bpm, stopped: () => shell.stopped, beginBar, step });

  const source: SequencedSource = {
    id: 'synthwave',
    family: 'music',
    onBeat: null,
    onBar: null,
    connect(dest) { out.connect(dest); },
    start(at) {
      if (started) return;
      started = true;
      const t = Math.max(at, ctx.currentTime);
      shell.start(t);
      shell.sched.add(t + 0.05, lane);
    },
    stop(at) { shell.stop(at); },
    setParam(key, value, rampSec) {
      if (key === 'synthwave.bpm') params.bpm = clamp(value, 84, 100);
      else if (key === 'synthwave.tape') { params.tape = clamp(value, 0, 1); tape.setAmount(params.tape, ctx.currentTime, rampSec); }
      else if (key === 'synthwave.pump') params.pump = clamp(value, 0, 1);
      else if (key === 'synthwave.arp') params.arp = clamp(value, 0, 1);   // read by the next arp note
    },
    dispose() { shell.dispose(); },
  };
  return source;
};
