// wind — brown noise through a wide, slowly moving bandpass, with gusts.
//
//   brown loop → BPF (200–800 Hz wander over 5–15 s, Q 0.7: never a whistle)
//              → gust gain (0.45–1.0 swells over 4–8 s) → env
import { noiseLoop } from '../dsp';
import { BaseSource } from '../source';

class WindSource extends BaseSource {
  constructor(ctx: AudioContext) {
    super('wind', 'air', ctx, 17);

    const bp = this.own(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 400, Q: 0.7 }));
    const gust = this.own(new GainNode(ctx, { gain: 0.7 }));
    this.play(noiseLoop(ctx, 'brown')).connect(bp).connect(gust).connect(this.env);

    this.sched.wander(bp.frequency, 200, 800, 5, 15, true);
    this.sched.wander(gust.gain, 0.45, 1.0, 4, 8);
  }
}

export const wind = (ctx: AudioContext) => new WindSource(ctx);
