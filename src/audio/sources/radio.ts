// radio — a shortwave receiver between stations. No voices on purpose:
// intelligible speech is the one sound that breaks verbal work.
//
//   white loop → BPF 2.4 kHz (Q 0.6) → LPF 5 kHz → fading gain → env
//       fading wanders 0.45..1 every 1.5–5 s                     (the static)
//   sferics: 1–6 ms grains, Poisson 3–12/s → HPF 1.5 kHz → env   (−16 dB)
//   whistle: every 9–22 s a heterodyne glides between two
//            pitches in 300–2400 Hz over 1.5–3.5 s → env          (−30 dB)
import { dB, grain, noiseLoop, poissonGap, rand } from '../dsp';
import { BaseSource } from '../source';

class RadioSource extends BaseSource {
  private sfericRate = 6;

  constructor(ctx: AudioContext) {
    super('radio', 'place', ctx, 9);

    // Static, breathing the way a distant signal fades in and out.
    const bpf = this.own(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 2400, Q: 0.6 }));
    const lpf = this.own(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 5000, Q: 0.5 }));
    const fading = this.own(new GainNode(ctx, { gain: 0.8 }));
    this.play(noiseLoop(ctx, 'white')).connect(bpf).connect(lpf).connect(fading).connect(this.env);
    this.sched.wander(fading.gain, 0.45, 1, 1.5, 5);
    this.sched.wander(bpf.frequency, 1800, 3200, 2, 6, true);

    // Sferics: atmospheric crackle, density drifting like weather far away.
    const hpf = this.own(new BiquadFilterNode(ctx, { type: 'highpass', frequency: 1500, Q: 0.7 }));
    hpf.connect(this.env);
    this.sched.repeat(() => rand(2, 6), () => { this.sfericRate = rand(3, 12); });
    this.sched.repeat(() => poissonGap(this.sfericRate), (t) => {
      grain(ctx, hpf, t, rand(0.001, 0.006), dB(-16) * 2.5);
    });

    // Tuning whistle: a carrier drifting past, rare and quiet.
    this.sched.repeat(() => rand(9, 22), (t) => this.whistle(t), rand(4, 10));
  }

  private whistle(t: number): void {
    const ctx = this.ctx;
    const dur = rand(1.5, 3.5);
    const osc = new OscillatorNode(ctx, { type: 'sine', frequency: rand(300, 2400) });
    osc.frequency.setValueAtTime(osc.frequency.value, t);
    osc.frequency.exponentialRampToValueAtTime(rand(300, 2400), t + dur);
    const env = new GainNode(ctx, { gain: 0 });
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(dB(-30), t + dur * 0.4);
    env.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(env).connect(this.env);
    osc.onended = () => { osc.disconnect(); env.disconnect(); };
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

export const radio = (ctx: AudioContext) => new RadioSource(ctx);
