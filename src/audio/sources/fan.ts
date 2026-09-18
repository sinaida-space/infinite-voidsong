// fan — mains hum under a shallowly fluttering pink wash.
//
//   sines 50 / 100 / 150 / 200 Hz, −18 dB → env             (motor hum)
//   pink loop → LPF 3 kHz → AM (22 Hz, depth 8 %) → env      (blade wash)
import { dB, noiseLoop } from '../dsp';
import { BaseSource } from '../source';

class FanSource extends BaseSource {
  constructor(ctx: AudioContext) {
    super('fan', 'place', ctx, -2);

    const hum = this.own(new GainNode(ctx, { gain: dB(-18) }));
    hum.connect(this.env);
    for (const hz of [50, 100, 150, 200]) {
      this.play(new OscillatorNode(ctx, { type: 'sine', frequency: hz })).connect(hum);
    }

    // 8 % depth: gain sits at 0.96 and the LFO adds ±0.04.
    const lpf = this.own(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 3000, Q: 0.5 }));
    const am = this.own(new GainNode(ctx, { gain: 0.96 }));
    const lfo = this.play(new OscillatorNode(ctx, { type: 'sine', frequency: 22 }));
    const depth = this.own(new GainNode(ctx, { gain: 0.04 }));
    lfo.connect(depth).connect(am.gain);
    this.play(noiseLoop(ctx, 'pink')).connect(lpf).connect(am).connect(this.env);
  }
}

export const fan = (ctx: AudioContext) => new FanSource(ctx);
