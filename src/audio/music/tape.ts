// "Tape" colouring for the lofi source: dull the top end, add slow pitch wow,
// and soften peaks with a tanh saturator.
import { rampHz, type NodeBag } from './util';

export interface Tape {
  input: AudioNode;
  output: AudioNode;
  setAmount(amount: number, at: number, rampSec: number): void;   // lofi.tape 0..1
}

// tanh transfer curve: gentle compression of peaks, odd harmonics on loud hits.
// `drive` scales the input before the tanh; the output is normalised to tanh(drive).
function tanhCurve(drive: number, samples = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples);
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

// Cutoff sweeps 8 kHz (tape 0) down to 4 kHz (tape 1).
const cutoffFor = (amount: number): number => 8000 - 4000 * Math.min(1, Math.max(0, amount));

export function makeTape(ctx: AudioContext, bag: NodeBag, amount: number): Tape {
  const lpf = bag.add(ctx.createBiquadFilter());
  lpf.type = 'lowpass';
  lpf.frequency.value = cutoffFor(amount);
  lpf.Q.value = 0.7;

  // Wow: an 8 ms delay whose time wobbles by ±0.3 ms at 0.4 Hz. Modulating the
  // delay length bends pitch slightly, like a worn capstan.
  const wow = bag.add(ctx.createDelay(0.05));
  wow.delayTime.value = 0.008;
  const lfo = bag.add(ctx.createOscillator());
  lfo.type = 'sine';
  lfo.frequency.value = 0.4;
  const lfoDepth = bag.add(ctx.createGain());
  lfoDepth.gain.value = 0.0003;
  lfo.connect(lfoDepth).connect(wow.delayTime);
  lfo.start();

  const shaper = bag.add(ctx.createWaveShaper());
  shaper.curve = tanhCurve(1.6);
  shaper.oversample = '2x';

  lpf.connect(wow).connect(shaper);

  return {
    input: lpf,
    output: shaper,
    setAmount(a, at, rampSec) { rampHz(lpf.frequency, cutoffFor(a), at, rampSec); },
  };
}
