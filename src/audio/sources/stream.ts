// stream — three narrow bands of white noise that drift, with a light flutter.
//
//   white loop → BPF 900 / 1800 / 3200 Hz (Q 4, centres random-walk ±20 %
//                over 2–5 s) → sum → flutter AM (6–9 Hz, depth 15 %) → env
import { noiseLoop } from '../dsp';
import { BaseSource } from '../source';

const CENTRES = [900, 1800, 3200];

class StreamSource extends BaseSource {
  constructor(ctx: AudioContext) {
    super('stream', 'water', ctx, 12);

    const white = this.play(noiseLoop(ctx, 'white'));
    const sum = this.own(new GainNode(ctx, { gain: 1 }));
    for (const hz of CENTRES) {
      const bp = this.own(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: hz, Q: 4 }));
      white.connect(bp).connect(sum);
      this.sched.wander(bp.frequency, hz * 0.8, hz * 1.2, 2, 5, true);
    }

    // Flutter: sine LFO into the AM gain around 0.85 ± 0.15.
    const am = this.own(new GainNode(ctx, { gain: 0.85 }));
    const lfo = this.play(new OscillatorNode(ctx, { type: 'sine', frequency: 7 }));
    const depth = this.own(new GainNode(ctx, { gain: 0.15 }));
    lfo.connect(depth).connect(am.gain);
    this.sched.wander(lfo.frequency, 6, 9, 3, 8);
    sum.connect(am).connect(this.env);
  }
}

export const stream = (ctx: AudioContext) => new StreamSource(ctx);
