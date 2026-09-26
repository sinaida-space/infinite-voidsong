// tape — a cassette deck playing blank tape: hiss, transport, oxide rustle.
//
//   pink loop → HPF 2.5 kHz → LPF 11 kHz → wow/flutter AM → dropout gate → env
//       wow 0.55 Hz ±4 %, flutter 6.5 Hz ±1.5 %                  (the hiss)
//   brown loop → LPF 160 Hz, level wanders −24..−18 dB → env      (motor and reels)
//   rustle: 4–30 ms grains, Poisson 2–6/s → BPF 1.2–4 kHz → env   (−22 dB)
//   dropout: every 7–18 s the hiss dips to 35 % for 80–250 ms     (worn oxide)
import { dB, grain, noiseLoop, poissonGap, rand } from '../dsp';
import { BaseSource } from '../source';

class TapeSource extends BaseSource {
  private rustleRate = 3;

  constructor(ctx: AudioContext) {
    super('tape', 'place', ctx, 6);

    // Hiss
    const hpf = this.own(new BiquadFilterNode(ctx, { type: 'highpass', frequency: 2500, Q: 0.5 }));
    const lpf = this.own(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 11000, Q: 0.5 }));
    const wowFlutter = this.own(new GainNode(ctx, { gain: 0.945 }));
    for (const [hz, depth] of [[0.55, 0.04], [6.5, 0.015]]) {
      const lfo = this.play(new OscillatorNode(ctx, { type: 'sine', frequency: hz }));
      lfo.connect(this.own(new GainNode(ctx, { gain: depth }))).connect(wowFlutter.gain);
    }
    const dropout = this.own(new GainNode(ctx, { gain: 1 }));
    this.play(noiseLoop(ctx, 'pink')).connect(hpf).connect(lpf).connect(wowFlutter).connect(dropout).connect(this.env);

    this.sched.repeat(() => rand(7, 18), (t) => {
      const len = rand(0.08, 0.25);
      dropout.gain.setValueAtTime(1, t);
      dropout.gain.linearRampToValueAtTime(0.35, t + 0.02);
      dropout.gain.setValueAtTime(0.35, t + len);
      dropout.gain.linearRampToValueAtTime(1, t + len + 0.04);
    });

    // Transport: the motor and the reels, a low rumble that never sits still.
    const rumbleLpf = this.own(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 160, Q: 0.7 }));
    const rumble = this.own(new GainNode(ctx, { gain: dB(-21) }));
    this.play(noiseLoop(ctx, 'brown')).connect(rumbleLpf).connect(rumble).connect(this.env);
    this.sched.wander(rumble.gain, dB(-24), dB(-18), 3, 7);

    // Rustle: tape rubbing the head and guides, soft and irregular.
    const band = this.own(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 2000, Q: 0.9 }));
    band.connect(this.env);
    this.sched.wander(band.frequency, 1200, 4000, 1, 3, true);
    this.sched.repeat(() => rand(2, 6), () => { this.rustleRate = rand(2, 6); });
    this.sched.repeat(() => poissonGap(this.rustleRate), (t) => {
      grain(ctx, band, t, rand(0.004, 0.03), dB(-22) * 2.5);
    });
  }
}

export const tape = (ctx: AudioContext) => new TapeSource(ctx);
