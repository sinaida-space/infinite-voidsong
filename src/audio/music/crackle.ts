// Vinyl bed for chillhop: Poisson-spaced clicks (8–20 per second, each a
// 2–4 ms noise tick above 2 kHz at -26 dB) over a loop of pink hiss at -34 dB.
// One knob scales both, so 0 is a clean record and 1 is a worn one.
import { pinkNoiseBuffer } from './buffers';
import { noiseBurst, cleanupOnEnd } from './hits';
import type { Scheduler } from './scheduler';
import { clamp, dbToGain, expRandom, ramp, rand, type NodeBag } from './util';

export interface Crackle {
  output: AudioNode;
  start(at: number): void;
  setAmount(amount: number, at: number, rampSec: number): void;
}

const CLICK_DB = -26;
const HISS_DB = -34;
const RATE_MIN = 8, RATE_MAX = 20;   // clicks per second; redrawn every few seconds so the wear is uneven
const REDRAW_EVERY = 40;             // clicks between rate changes

export function makeCrackle(ctx: AudioContext, bag: NodeBag, sched: Scheduler, stopped: () => boolean, amount: number): Crackle {
  const output = bag.add(ctx.createGain());
  output.gain.value = clamp(amount, 0, 1);

  // Hiss: the stereo pink loop, filtered to the 1–6 kHz band where dust lives.
  const hiss = bag.add(ctx.createBufferSource());
  hiss.buffer = pinkNoiseBuffer(ctx);
  hiss.loop = true;
  const hissBand = bag.add(ctx.createBiquadFilter());
  hissBand.type = 'bandpass';
  hissBand.frequency.value = 2500;
  hissBand.Q.value = 0.4;
  const hissGain = bag.add(ctx.createGain());
  hissGain.gain.value = dbToGain(HISS_DB);
  hiss.connect(hissBand).connect(hissGain).connect(output);

  // Clicks: high-passed noise ticks. All clicks share one filter and one level.
  const clickHpf = bag.add(ctx.createBiquadFilter());
  clickHpf.type = 'highpass';
  clickHpf.frequency.value = 2000;
  const clickGain = bag.add(ctx.createGain());
  clickGain.gain.value = dbToGain(CLICK_DB);
  clickHpf.connect(clickGain).connect(output);

  let rate = rand(RATE_MIN, RATE_MAX);
  let sinceRedraw = 0;
  const click = (t: number): number | null => {
    if (stopped()) return null;
    const sec = rand(0.002, 0.004);
    const burst = noiseBurst(ctx, t, sec);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(rand(0.4, 1), t + 0.0005);
    g.gain.linearRampToValueAtTime(0, t + sec);
    burst.connect(g).connect(clickHpf);
    cleanupOnEnd(burst, g);
    if (++sinceRedraw >= REDRAW_EVERY) { sinceRedraw = 0; rate = rand(RATE_MIN, RATE_MAX); }
    return t + expRandom(1 / rate);
  };

  return {
    output,
    start(at) {
      hiss.start(at, rand(0, 3));
      sched.add(at + 0.1, click);
    },
    setAmount(a, at, rampSec) { ramp(output.gain, clamp(a, 0, 1), at, rampSec); },
  };
}
