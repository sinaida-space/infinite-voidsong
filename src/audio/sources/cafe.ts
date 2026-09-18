// cafe — room tone, eight murmuring voices, cups, an espresso machine.
//
//   pink loop → LPF 4 kHz → room gain → env                     (the room)
//   babble ×8 → LPF 1.8 kHz → −6 dB under the room → env         (murmur)
//   clink: two-partial sine ping 3–5 kHz, 0.4 s, every 6–20 s, −16 dB
//   espresso: white loop → HPF 3 kHz → swell 2 s every 60–180 s, −12 dB
import { dB, noiseLoop, ping, rand } from '../dsp';
import { BaseSource } from '../source';
import { Babble } from './babble';

class CafeSource extends BaseSource {
  constructor(ctx: AudioContext) {
    super('cafe', 'place', ctx, 3);

    // Room
    const roomLpf = this.own(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 4000, Q: 0.5 }));
    const room = this.own(new GainNode(ctx, { gain: 1 }));
    this.play(noiseLoop(ctx, 'pink')).connect(roomLpf).connect(room).connect(this.env);

    // Murmur
    const babble = new Babble(ctx, this.sched, 8);
    this.onStart((at) => babble.start(at));
    this.onDispose(() => babble.dispose());
    const murmurLpf = this.own(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 1800, Q: 0.7 }));
    const murmur = this.own(new GainNode(ctx, { gain: dB(-6) * 1.6 }));
    babble.output.connect(murmurLpf).connect(murmur).connect(this.env);

    // Clinks
    this.sched.repeat(() => rand(6, 20), (t) => {
      const hz = rand(3000, 5000);
      ping(ctx, this.env, t, hz, dB(-16), 0.005, 0.4);
      ping(ctx, this.env, t, hz * 2.76, dB(-24), 0.005, 0.25);
    });

    // Espresso
    const hpf = this.own(new BiquadFilterNode(ctx, { type: 'highpass', frequency: 3000, Q: 0.7 }));
    const espresso = this.own(new GainNode(ctx, { gain: 0 }));
    this.play(noiseLoop(ctx, 'white')).connect(hpf).connect(espresso).connect(this.env);
    this.sched.repeat(() => rand(60, 180), (t) => {
      espresso.gain.setValueAtTime(0, t);
      espresso.gain.linearRampToValueAtTime(dB(-12), t + 1);
      espresso.gain.linearRampToValueAtTime(0, t + 2);
    }, rand(20, 60));
  }
}

export const cafe = (ctx: AudioContext) => new CafeSource(ctx);
