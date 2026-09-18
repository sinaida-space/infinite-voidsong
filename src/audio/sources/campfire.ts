// campfire — low rumble, crackle, two crickets.
//
//   brown loop → LPF 300 Hz → env                              (the fire body)
//   crackle: 1–8 ms grains, Poisson 6–15/s → HPF 1 kHz → env   (−14 dB)
//   crickets ×2: sine 4.2–4.8 kHz → 30 Hz AM → chirp gate
//                (0.4 s every 1–2 s) → panner → env             (−26 dB)
import { dB, grain, noiseLoop, poissonGap, rand } from '../dsp';
import { BaseSource } from '../source';

class CampfireSource extends BaseSource {
  private crackleRate = 10;

  constructor(ctx: AudioContext) {
    super('campfire', 'fire', ctx, -2);

    // Body
    const lpf = this.own(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 300, Q: 0.7 }));
    this.play(noiseLoop(ctx, 'brown')).connect(lpf).connect(this.env);

    // Crackle: density drifts, each pop is a sub-10 ms grain well under the bed.
    const hpf = this.own(new BiquadFilterNode(ctx, { type: 'highpass', frequency: 1000, Q: 0.7 }));
    hpf.connect(this.env);
    this.sched.repeat(() => rand(3, 8), () => { this.crackleRate = rand(6, 15); });
    this.sched.repeat(() => poissonGap(this.crackleRate), (t) => {
      grain(ctx, hpf, t, rand(0.001, 0.008), dB(-14) * 2.5);
    });

    // Crickets: two insects, independent pitch and timing, one each side.
    for (const pan of [-0.6, 0.6]) this.insect(pan);
  }

  private insect(pan: number): void {
    const ctx = this.ctx;
    const tone = this.play(new OscillatorNode(ctx, { type: 'sine', frequency: rand(4200, 4800) }));
    // 30 Hz AM: gain sits at 0.5 and the LFO adds ±0.5.
    const am = this.own(new GainNode(ctx, { gain: 0.5 }));
    const lfo = this.play(new OscillatorNode(ctx, { type: 'sine', frequency: 30 }));
    const depth = this.own(new GainNode(ctx, { gain: 0.5 }));
    lfo.connect(depth).connect(am.gain);
    const gate = this.own(new GainNode(ctx, { gain: 0 }));
    const panner = this.own(new StereoPannerNode(ctx, { pan }));
    tone.connect(am).connect(gate).connect(panner).connect(this.env);

    const level = dB(-26);
    this.sched.repeat(() => rand(1, 2), (t) => {
      gate.gain.setValueAtTime(0, t);
      gate.gain.linearRampToValueAtTime(level, t + 0.03);
      gate.gain.setValueAtTime(level, t + 0.36);
      gate.gain.linearRampToValueAtTime(0, t + 0.4);
    }, rand(0.5, 2));
  }
}

export const campfire = (ctx: AudioContext) => new CampfireSource(ctx);
