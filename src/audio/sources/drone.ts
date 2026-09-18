// Drone: six detuned oscillators on a slowly breathing low-pass, wide reverb.
// Voicing drifts one scale step at a time (every 30–90 s, 8 s glide) so the
// chord never repeats a fixed cycle and never moves abruptly.
import type { SoundSource, SourceFactory } from '../music/types';
import { makeShell } from '../music/shell';
import { makeReverb } from '../music/reverb';
import { degreeToHz } from '../music/scale';
import { dbToGain, rand, rampHz, pick } from '../music/util';

// Waveform, home scale degree and level per voice. Degrees are relative to the
// session root (7 = octave). Bass sine sits an octave below the root.
const VOICES: { type: OscillatorType; degree: number; db: number }[] = [
  { type: 'sine',     degree: -7, db: 0 },
  { type: 'sine',     degree: 0,  db: -2 },
  { type: 'triangle', degree: 4,  db: -4 },    // 5th
  { type: 'triangle', degree: 2,  db: -5 },    // 3rd
  { type: 'sawtooth', degree: 7,  db: -10 },   // saws at -10 dB: colour, not body
  { type: 'sawtooth', degree: 9,  db: -10 },   // 3rd an octave up
];
const FILTER_HZ = 900;
const LFO_HZ = 0.05;            // one breath every 20 s
const LFO_DEPTH_HZ = 300;
const GLIDE_SEC = 8;
const MOVE_MIN_SEC = 30, MOVE_MAX_SEC = 90;
const RANGE = 2;                // a voice wanders at most ±2 degrees from home

export const drone: SourceFactory = (ctx: AudioContext): SoundSource => {
  // Attack >= 4 s: fade-in 6 s. Overall level trimmed so six voices sit as a bed.
  const shell = makeShell(ctx, { level: 0.45, fadeIn: 6, fadeOut: 4 });
  const { bag, out } = shell;

  // Low-pass with a slow LFO on its cutoff.
  const lpf = bag.add(ctx.createBiquadFilter());
  lpf.type = 'lowpass';
  lpf.frequency.value = FILTER_HZ;
  lpf.Q.value = 0.8;
  const lfo = bag.add(ctx.createOscillator());
  lfo.type = 'sine';
  lfo.frequency.value = LFO_HZ;
  const lfoDepth = bag.add(ctx.createGain());
  lfoDepth.gain.value = LFO_DEPTH_HZ;
  lfo.connect(lfoDepth).connect(lpf.frequency);

  // Dry + reverb into the shell output.
  const reverb = makeReverb(ctx, bag, 0.5);
  lpf.connect(out);
  lpf.connect(reverb.input);
  reverb.output.connect(out);

  // Voices: oscillator -> gain -> filter. Detune alternates ±7 cents with a
  // little jitter so pairs beat slowly against each other.
  const voices = VOICES.map((v, i) => {
    const osc = bag.add(ctx.createOscillator());
    osc.type = v.type;
    osc.frequency.value = degreeToHz(v.degree);
    osc.detune.value = (i % 2 === 0 ? 1 : -1) * rand(5, 7);
    const g = bag.add(ctx.createGain());
    g.gain.value = dbToGain(v.db) * 0.22;
    osc.connect(g).connect(lpf);
    return { osc, degree: v.degree, home: v.degree };
  });

  let started = false;

  // Move one non-bass voice a single scale step (bounded to its home ±RANGE),
  // gliding over 8 s. The next move is 30–90 s away.
  const move = (t: number): number => {
    const v = pick(voices.slice(1));
    const candidates = [v.degree - 1, v.degree + 1].filter(d => Math.abs(d - v.home) <= RANGE);
    v.degree = pick(candidates);
    rampHz(v.osc.frequency, degreeToHz(v.degree), t, GLIDE_SEC);
    return t + rand(MOVE_MIN_SEC, MOVE_MAX_SEC);
  };

  return {
    id: 'drone',
    family: 'music',
    connect(dest) { out.connect(dest); },
    start(at) {
      if (started) return;
      started = true;
      const t = Math.max(at, ctx.currentTime);
      lfo.start(t);
      for (const v of voices) v.osc.start(t);
      shell.start(t);
      shell.sched.add(t + rand(MOVE_MIN_SEC, MOVE_MAX_SEC), move);
    },
    stop(at) { shell.stop(at); },
    setParam() { /* the drone has no user knobs */ },
    dispose() { shell.dispose(); },
  };
};
