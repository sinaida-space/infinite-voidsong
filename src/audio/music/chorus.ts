// Stereo chorus for the synthwave pads: two short delays (12 ms and 17 ms)
// whose length wobbles by ±1.5 ms at slightly different rates, panned left
// and right and mixed with the dry signal. The moving delays detune the copies
// a few cents against the dry pad, which is what makes one voice sound wide.
import type { NodeBag } from './util';

export interface Chorus { input: AudioNode; output: AudioNode; }

const TAPS = [
  { delaySec: 0.012, lfoHz: 0.6, pan: -0.7 },
  { delaySec: 0.017, lfoHz: 0.8, pan: 0.7 },
];
const DEPTH_SEC = 0.0015;
const WET = 0.5;   // each tap at half level: dry + two taps sum to about +3 dB, trimmed by the caller

export function makeChorus(ctx: AudioContext, bag: NodeBag): Chorus {
  const input = bag.add(ctx.createGain());
  const output = bag.add(ctx.createGain());
  input.connect(output);   // dry
  for (const tap of TAPS) {
    const delay = bag.add(ctx.createDelay(0.05));
    delay.delayTime.value = tap.delaySec;
    const lfo = bag.add(ctx.createOscillator());
    lfo.type = 'sine';
    lfo.frequency.value = tap.lfoHz;
    const depth = bag.add(ctx.createGain());
    depth.gain.value = DEPTH_SEC;
    lfo.connect(depth).connect(delay.delayTime);
    lfo.start();
    const pan = bag.add(ctx.createStereoPanner());
    pan.pan.value = tap.pan;
    const wet = bag.add(ctx.createGain());
    wet.gain.value = WET;
    input.connect(delay).connect(pan).connect(wet).connect(output);
  }
  return { input, output };
}
