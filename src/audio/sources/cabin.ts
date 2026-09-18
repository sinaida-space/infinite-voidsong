// cabin — airliner rumble with a slowly wavering engine tone.
//
//   brown loop → env                                     (airframe)
//   sines 95 + 190 Hz, −12 dB, pitch wander ±3 % over 8–20 s → env
//   pink loop → LPF 2 kHz → air gain (wander ±2 dB over ~20 s) → env
import { dB, noiseLoop } from '../dsp';
import { BaseSource } from '../source';

class CabinSource extends BaseSource {
  constructor(ctx: AudioContext) {
    super('cabin', 'place', ctx, -3);

    this.play(noiseLoop(ctx, 'brown')).connect(this.env);

    const engine = this.own(new GainNode(ctx, { gain: dB(-12) }));
    engine.connect(this.env);
    for (const hz of [95, 190]) {
      const osc = this.play(new OscillatorNode(ctx, { type: 'sine', frequency: hz }));
      osc.connect(engine);
      this.sched.wander(osc.frequency, hz * 0.97, hz * 1.03, 8, 20, true);
    }

    const lpf = this.own(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 2000, Q: 0.7 }));
    const air = this.own(new GainNode(ctx, { gain: 1 }));
    this.play(noiseLoop(ctx, 'pink')).connect(lpf).connect(air).connect(this.env);
    this.sched.wander(air.gain, dB(-2), dB(2), 15, 25);
  }
}

export const cabin = (ctx: AudioContext) => new CabinSource(ctx);
