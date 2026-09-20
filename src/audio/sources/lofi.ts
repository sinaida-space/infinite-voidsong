// Lofi: a swung 16th-note drum machine (kick, snare, hat) with a 4-pattern pool
// that never repeats a bar back to back, Rhodes-ish FM chords on ii–V–I–vi every
// two bars, sidechained to the kick, all through a tape stage and a short reverb.
import type { BarInfo, LofiSource, SourceFactory } from '../music/types';
import { makeShell } from '../music/shell';
import { makeReverb } from '../music/reverb';
import { makeTape } from '../music/tape';
import { makeSidechain } from '../music/sidechain';
import { whiteNoiseBuffer } from '../music/buffers';
import { chordDegrees, degreeToHz } from '../music/scale';
import { makeHarmonyCursor } from '../music/harmony';
import { drumPhrase } from '../music/phrase';
import { emitBeat } from '../music/beat';
import { clamp, rand } from '../music/util';

const DEFAULTS = { bpm: 78, tape: 0.5, pump: 0.4 };
const STEPS = 16;                 // 16th notes per 4/4 bar
const SWING = 0.56;               // the first 16th of each pair takes 56 % of the eighth
const HAT_DROP_CHANCE = 0.12;     // humanise: some hats go missing
const CHORD_EVERY_BARS = 2;

// Pattern pool. Kicks are never closer than two steps (one eighth) so the
// sidechain recovery of 250 ms always finishes before the next dip.
interface Pattern { kick: string; snare: string; hat: string; }
const POOL: Pattern[] = [
  { kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  { kick: 'x..x......x.....', snare: '....x.......x..x', hat: 'x.xxx.x.x.x.x.xx' },
  { kick: 'x.....x.x.......', snare: '....x.......x...', hat: '.x.x.x.x.x.x.x.x' },
  { kick: 'x......x..x.....', snare: '....x......x....', hat: 'x.x.x.xxx.x.x.x.' },
];

interface RhodesNote { carrier: OscillatorNode; mod: OscillatorNode; amp: GainNode; index: GainNode; }

export const lofi: SourceFactory = (ctx: AudioContext): LofiSource => {
  // On teardown, release any held Rhodes notes so their oscillators stop too.
  const shell = makeShell(ctx, { level: 0.6, fadeIn: 2, fadeOut: 2 }, () => rhodesRelease(ctx.currentTime));
  const { bag, out } = shell;
  const params = { ...DEFAULTS };

  // Buses: drums -> tape; rhodes -> sidechain -> tape; tape -> out (+ reverb).
  const drumBus = bag.add(ctx.createGain());
  const sidechain = makeSidechain(ctx, bag);
  const tape = makeTape(ctx, bag, params.tape);
  const reverb = makeReverb(ctx, bag, 0.2);
  drumBus.connect(tape.input);
  sidechain.node.connect(tape.input);
  tape.output.connect(out);
  tape.output.connect(reverb.input);
  reverb.output.connect(out);

  const noise = whiteNoiseBuffer(ctx);
  // A one-shot helper: a short slice of the noise buffer from a random offset.
  const noiseBurst = (t: number, sec: number): AudioBufferSourceNode => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.start(t, rand(0, noise.duration - sec - 0.01), sec);
    return src;
  };
  const cleanup = (src: AudioScheduledSourceNode, ...rest: AudioNode[]): void => {
    src.onended = () => { src.disconnect(); for (const n of rest) n.disconnect(); };
  };

  // Kick: sine dropping 120 -> 60 Hz in 40 ms, 300 ms decay.
  const kick = (t: number): void => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.04);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(drumBus);
    osc.start(t);
    osc.stop(t + 0.32);
    cleanup(osc, g);
  };

  // Snare: 120 ms noise burst through a band-pass at 1.8 kHz plus a short 180 Hz sine body.
  const snare = (t: number): void => {
    const burst = noiseBurst(t, 0.12);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 1800;
    bpf.Q.value = 1;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.6, t + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    burst.connect(bpf).connect(ng).connect(drumBus);
    cleanup(burst, bpf, ng);

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.value = 180;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(0.4, t + 0.003);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    body.connect(bg).connect(drumBus);
    body.start(t);
    body.stop(t + 0.1);
    cleanup(body, bg);
  };

  // Hat: 40 ms of noise above 8 kHz, velocity varies per hit.
  const hat = (t: number, vel: number): void => {
    const burst = noiseBurst(t, 0.04);
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 8000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22 * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    burst.connect(hpf).connect(g).connect(drumBus);
    cleanup(burst, hpf, g);
  };

  // Rhodes-ish note: 2-op FM, modulator at 2x the carrier, low index that
  // decays with the amplitude so the attack has a little bark and the tail is
  // nearly a sine. Held until release().
  let active: RhodesNote[] = [];
  const rhodesOn = (t: number, hz: number, vel: number): void => {
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = hz;
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = hz * 2;
    // Modulation index I = deviation / modFreq; deviation = hz*0.8 -> I = 0.4, tail I = 0.1.
    const index = ctx.createGain();
    index.gain.setValueAtTime(hz * 0.8, t);
    index.gain.exponentialRampToValueAtTime(hz * 0.2, t + 1);
    mod.connect(index).connect(carrier.frequency);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(vel, t + 0.03);
    amp.gain.exponentialRampToValueAtTime(vel * 0.35, t + 1.2);
    carrier.connect(amp).connect(sidechain.node);
    carrier.start(t);
    mod.start(t);
    active.push({ carrier, mod, amp, index });
  };
  const rhodesRelease = (t: number): void => {
    for (const n of active) {
      n.amp.gain.cancelScheduledValues(t);
      n.amp.gain.setValueAtTime(n.amp.gain.value, t);
      n.amp.gain.linearRampToValueAtTime(0, t + 0.4);
      n.carrier.stop(t + 0.45);
      n.mod.stop(t + 0.45);
      n.carrier.onended = () => { n.carrier.disconnect(); n.mod.disconnect(); n.amp.disconnect(); n.index.disconnect(); };
    }
    active = [];
  };

  // Sequencer state.
  let bar = 0;
  let stepIndex = 0;
  let barStart = 0;
  let barBpm = params.bpm;          // tempo is read once per bar so a bar keeps one grid
  let lastPattern = -1;
  let current: Pattern = POOL[0];
  let phrase: Pattern[] = [];       // Harmony Gentle / Drift: the bars of the current phrase (one bar when Off)
  const harmony = makeHarmonyCursor(CHORD_EVERY_BARS);
  let started = false;

  const stepTime = (s: number): number => {
    const sixteenth = 60 / barBpm / 4;
    const pair = sixteenth * 2;
    return barStart + Math.floor(s / 2) * pair + (s % 2 ? SWING * pair : 0);
  };

  // Called once per bar at step 0: pick a pattern different from the last one,
  // humanise the hats, advance the chord if due, and report the bar.
  const beginBar = (t: number): void => {
    barBpm = params.bpm;
    barStart = t;
    const h = harmony(bar, t, (60 / barBpm) * 4);
    // A new pattern each bar (Off), each two bars (Gentle) or each four bars (Drift); never the same twice in a row.
    if (h.phraseBar === 0) {
      let p: number;
      do { p = Math.floor(Math.random() * POOL.length); } while (p === lastPattern);
      lastPattern = p;
      phrase = drumPhrase(POOL[p], h.phraseBars);
    }
    const p = lastPattern;
    const base = phrase[h.phraseBar];
    const hats = base.hat.split('').map(c => (c === 'x' && Math.random() < HAT_DROP_CHANCE ? '.' : c)).join('');
    current = { kick: base.kick, snare: base.snare, hat: hats };

    let chord: string | null = null;
    if (h.roman) {
      const roman = h.roman;
      chord = roman;
      rhodesRelease(t);
      // Voiced an octave below the root register, occasionally with the top note dropped an octave.
      const degrees = chordDegrees(roman);
      const voicing = Math.random() < 0.3 ? [degrees[0], degrees[1], degrees[2], degrees[3] - 7] : degrees;
      for (const d of voicing) rhodesOn(t + rand(0, 0.02), degreeToHz(d - 7, undefined, h.rootShift), rand(0.14, 0.2));
    }

    const info: BarInfo = { bar, time: t, bpm: barBpm, pattern: p, chord, signature: `${current.kick}|${current.snare}|${current.hat}` };
    source.onBar?.(info);
  };

  // Scheduler lane: one 16th step per call.
  const step = (t: number): number | null => {
    if (shell.stopped) return null;
    if (stepIndex === 0) beginBar(t);
    const s = stepIndex;
    if (current.kick[s] === 'x') { kick(t); sidechain.duck(t, params.pump); emitBeat(t); source.onBeat?.(t); }
    if (current.snare[s] === 'x') snare(t);
    if (current.hat[s] === 'x') hat(t, s % 4 === 0 ? rand(0.8, 1) : rand(0.4, 0.7));

    stepIndex++;
    if (stepIndex < STEPS) return stepTime(stepIndex);
    stepIndex = 0;
    bar++;
    return barStart + (60 / barBpm) * 4;
  };

  const source: LofiSource = {
    id: 'lofi',
    family: 'music',
    onBeat: null,
    onBar: null,
    connect(dest) { out.connect(dest); },
    start(at) {
      if (started) return;
      started = true;
      const t = Math.max(at, ctx.currentTime);
      shell.start(t);
      shell.sched.add(t + 0.05, step);
    },
    stop(at) { shell.stop(at); },
    setParam(key, value, rampSec) {
      if (key === 'lofi.bpm') params.bpm = clamp(value, 60, 100);
      else if (key === 'lofi.tape') { params.tape = clamp(value, 0, 1); tape.setAmount(params.tape, ctx.currentTime, rampSec); }
      else if (key === 'lofi.pump') params.pump = clamp(value, 0, 1);
    },
    dispose() { shell.dispose(); },
  };
  return source;
};
