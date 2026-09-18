// Tone: a sine at tone.freq crossfaded with pink noise band-passed around the
// same frequency. tone.width 0 = pure sine; 1 = wide band (Q 0.5). Output is
// capped at -18 dBFS. This file only names the source "Tone"; user-facing copy
// belongs to task 6.
import type { SoundSource, SourceFactory } from '../music/types';
import { makeShell } from '../music/shell';
import { pinkNoiseBuffer } from '../music/buffers';
import { clamp, dbToGain, ramp, rampHz } from '../music/util';

const DEFAULT_FREQ = 4000, DEFAULT_WIDTH = 0.3;
const MIN_FREQ = 200, MAX_FREQ = 12000;
const MAX_Q = 25;

// width 1 -> Q 0.5 (wide); width -> 0 narrows the band until the sine takes over.
const qFor = (width: number): number => Math.min(MAX_Q, 0.5 / Math.max(width, 0.02));
// A narrow band passes far less noise energy than a wide one; scale it back up
// so the crossfade feels level. Values chosen by ear against the sine.
const makeupFor = (q: number): number => Math.min(10, 2 * Math.sqrt(q / 0.5));

export const tone: SourceFactory = (ctx: AudioContext): SoundSource => {
  const shell = makeShell(ctx, { level: dbToGain(-18), fadeIn: 2, fadeOut: 2 });
  const { bag, out } = shell;

  let freq = DEFAULT_FREQ;
  let width = DEFAULT_WIDTH;

  // Sine path.
  const osc = bag.add(ctx.createOscillator());
  osc.type = 'sine';
  osc.frequency.value = freq;
  const sineGain = bag.add(ctx.createGain());
  osc.connect(sineGain).connect(out);

  // Noise path: looped pink noise -> band-pass at freq -> makeup -> crossfade gain.
  const noise = bag.add(ctx.createBufferSource());
  noise.buffer = pinkNoiseBuffer(ctx);
  noise.loop = true;
  const bpf = bag.add(ctx.createBiquadFilter());
  bpf.type = 'bandpass';
  bpf.frequency.value = freq;
  const makeup = bag.add(ctx.createGain());
  const noiseGain = bag.add(ctx.createGain());
  noise.connect(bpf).connect(makeup).connect(noiseGain).connect(out);

  // Equal-power crossfade: sine = cos, noise = sin of width * pi/2.
  const applyWidth = (at: number, sec: number): void => {
    const q = qFor(width);
    ramp(sineGain.gain, Math.cos(width * Math.PI / 2), at, sec);
    ramp(noiseGain.gain, Math.sin(width * Math.PI / 2), at, sec);
    ramp(bpf.Q, q, at, sec);
    ramp(makeup.gain, makeupFor(q), at, sec);
  };
  const applyFreq = (at: number, sec: number): void => {
    rampHz(osc.frequency, freq, at, sec);
    rampHz(bpf.frequency, freq, at, sec);
  };
  applyWidth(ctx.currentTime, 0.01);

  let started = false;
  return {
    id: 'tone',
    family: 'tone',
    connect(dest) { out.connect(dest); },
    start(at) {
      if (started) return;
      started = true;
      const t = Math.max(at, ctx.currentTime);
      osc.start(t);
      noise.start(t);
      shell.start(t);
    },
    stop(at) { shell.stop(at); },
    setParam(key, value, rampSec) {
      const at = ctx.currentTime;
      if (key === 'tone.freq') { freq = clamp(value, MIN_FREQ, MAX_FREQ); applyFreq(at, rampSec); }
      else if (key === 'tone.width') { width = clamp(value, 0, 1); applyWidth(at, rampSec); }
    },
    dispose() { shell.dispose(); },
  };
};
