// library — HVAC hush, three distant voices, the odd page turn.
//
//   brown loop → LPF 200 Hz → env                       (ventilation)
//   babble ×3 → LPF 1.2 kHz → −12 dB → env               (murmur far away)
//   page turn: 100 ms noise grain → BPF 2 kHz → env, every 20–60 s, −18 dB
import { dB, grain, noiseLoop, rand } from '../dsp';
import { BaseSource } from '../source';
import { Babble } from './babble';

class LibrarySource extends BaseSource {
  constructor(ctx: AudioContext) {
    super('library', 'place', ctx, 3);

    const hvac = this.own(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 200, Q: 0.7 }));
    this.play(noiseLoop(ctx, 'brown')).connect(hvac).connect(this.env);

    const babble = new Babble(ctx, this.sched, 3);
    this.onStart((at) => babble.start(at));
    this.onDispose(() => babble.dispose());
    const murmurLpf = this.own(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 1200, Q: 0.7 }));
    const murmur = this.own(new GainNode(ctx, { gain: dB(-12) * 1.6 }));
    babble.output.connect(murmurLpf).connect(murmur).connect(this.env);

    const page = this.own(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 2000, Q: 0.7 }));
    page.connect(this.env);
    this.sched.repeat(() => rand(20, 60), (t) => {
      grain(ctx, page, t, 0.1, dB(-18) * 2.5, 0.03);
    }, rand(5, 20));
  }
}

export const library = (ctx: AudioContext) => new LibrarySource(ctx);
