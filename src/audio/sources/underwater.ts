// underwater — muffled rumble, a slow beating sub tone, sparse bubbles.
//
//   brown loop → LPF 400 Hz → env
//   sines 58 + 61 Hz (3 Hz beat) → −18 dB → env
//   bubbles: sine glide 300→900 Hz over 80 ms, every 3–9 s, −20 dB
import { dB, noiseLoop, ping, rand } from '../dsp';
import { BaseSource } from '../source';

class UnderwaterSource extends BaseSource {
  constructor(ctx: AudioContext) {
    super('underwater', 'water', ctx, 3);

    const lpf = this.own(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 400, Q: 0.7 }));
    this.play(noiseLoop(ctx, 'brown')).connect(lpf).connect(this.env);

    const sub = this.own(new GainNode(ctx, { gain: dB(-18) }));
    sub.connect(this.env);
    for (const hz of [58, 61]) this.play(new OscillatorNode(ctx, { type: 'sine', frequency: hz })).connect(sub);

    // Bubbles: 30 ms attack keeps the onset within the rule, glide does the "bloop".
    this.sched.repeat(() => rand(3, 9), (t) => {
      ping(ctx, this.env, t, 300, dB(-20), 0.03, 0.08, 900);
    });
  }
}

export const underwater = (ctx: AudioContext) => new UnderwaterSource(ctx);
