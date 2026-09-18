// babble — unintelligible multi-talker murmur shared by cafe and library.
//
// Each voice:
//   sawtooth (male 110–140 Hz / female 190–240 Hz)
//     → three parallel bandpasses (F1 300–800, F2 900–2300, F3 2400–3000, Q 8)
//     → syllable gate (30 ms on, ≤ 200 ms hold, 40 ms off) → panner → sum
//
// Speech is faked at the phrase level only: 3–9 syllables at 3–5 Hz, then a
// pause of 0.5–2.5 s. Every syllable picks fresh formant targets and nudges
// the pitch, so no vowel is ever held longer than 200 ms and nothing can be
// heard as a word. All events are booked through the source's scheduler.
import { rand } from '../dsp';
import type { Scheduler } from '../scheduler';

const FORMANTS: Array<[number, number]> = [[300, 800], [900, 2300], [2400, 3000]];

export class Babble {
  readonly output: GainNode;
  private readonly nodes: AudioNode[] = [];
  private readonly oscs: OscillatorNode[] = [];

  constructor(private readonly ctx: AudioContext, sched: Scheduler, voices: number) {
    this.output = new GainNode(ctx, { gain: 1 / Math.sqrt(voices) });
    this.nodes.push(this.output);
    for (let i = 0; i < voices; i++) this.voice(sched, i / Math.max(1, voices - 1) * 1.6 - 0.8);
  }

  private voice(sched: Scheduler, pan: number): void {
    const ctx = this.ctx;
    const female = Math.random() < 0.5;
    const f0Range: [number, number] = female ? [190, 240] : [110, 140];
    let f0 = rand(f0Range[0], f0Range[1]);

    const osc = new OscillatorNode(ctx, { type: 'sawtooth', frequency: f0 });
    const gate = new GainNode(ctx, { gain: 0 });
    const panner = new StereoPannerNode(ctx, { pan });
    const targets = FORMANTS.map(([lo, hi]) => rand(lo, hi));
    const formants = targets.map((hz) => {
      const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: hz, Q: 8 });
      osc.connect(bp).connect(gate);
      return bp;
    });
    gate.connect(panner).connect(this.output);
    this.nodes.push(osc, gate, panner, ...formants);
    this.oscs.push(osc);

    // Phrase machine: `left` syllables remain; at 0 the next gap is a pause.
    let left = 0;
    let gap = rand(0.3, 1.5);
    sched.repeat(() => gap, (t) => {
      if (left === 0) {
        left = 3 + Math.floor(Math.random() * 7);
        gap = rand(0.5, 2.5);
        return;
      }
      left--;
      gap = rand(0.2, 0.33);                        // 3–5 syllables per second
      const hold = Math.min(0.2, gap * 0.6);        // voiced part, never > 200 ms

      gate.gain.setValueAtTime(0, t);
      gate.gain.linearRampToValueAtTime(1, t + 0.03);
      gate.gain.setValueAtTime(1, t + hold);
      gate.gain.linearRampToValueAtTime(0, t + hold + 0.04);

      // New vowel: formants glide to fresh targets in the first 60 ms.
      // Targets are tracked in JS because events are booked up to 300 ms
      // ahead, when the previous ramp may not have run yet.
      formants.forEach((bp, i) => {
        const [lo, hi] = FORMANTS[i];
        bp.frequency.setValueAtTime(targets[i], t);
        targets[i] = rand(lo, hi);
        bp.frequency.exponentialRampToValueAtTime(targets[i], t + 0.06);
      });
      // Prosody: pitch drifts ±8 % per syllable inside the voice's range.
      osc.frequency.setValueAtTime(f0, t);
      f0 = Math.min(f0Range[1], Math.max(f0Range[0], f0 * rand(0.92, 1.08)));
      osc.frequency.exponentialRampToValueAtTime(f0, t + 0.06);
    }, gap);
  }

  start(at: number): void { for (const o of this.oscs) o.start(at); }

  dispose(): void {
    for (const o of this.oscs) { try { o.stop(); } catch { /* not started */ } }
    for (const n of this.nodes) n.disconnect();
    this.nodes.length = 0;
    this.oscs.length = 0;
  }
}
