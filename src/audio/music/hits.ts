// One-shot drum hits shared by the electronic sources. Every hit builds its
// few nodes on the spot, plays at the exact audio time `t`, and disconnects
// itself when its oscillator or noise slice ends, so nothing leaks between bars.
// Every level moves by ramp: attacks are short linear ramps from 0, decays are
// exponential ramps to 0.001 (about -60 dB), never a jump.
import { whiteNoiseBuffer } from './buffers';
import { rand } from './util';

// Disconnect a one-shot chain once its source has ended.
export const cleanupOnEnd = (src: AudioScheduledSourceNode, ...rest: AudioNode[]): void => {
  src.onended = () => { src.disconnect(); for (const n of rest) n.disconnect(); };
};

// A `sec`-long slice of the shared white-noise buffer from a random offset.
export function noiseBurst(ctx: AudioContext, t: number, sec: number): AudioBufferSourceNode {
  const buf = whiteNoiseBuffer(ctx);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.start(t, rand(0, buf.duration - sec - 0.01), sec);
  return src;
}

export interface KickOpts {
  startHz: number;   // pitch at the transient
  endHz: number;     // pitch the body settles on
  dropSec: number;   // how fast the pitch falls (the "punch")
  decaySec: number;  // body length
  level: number;
}

// Kick: a sine whose pitch drops from startHz to endHz, with a short attack
// and an exponential body decay.
export function kick(ctx: AudioContext, dest: AudioNode, t: number, o: KickOpts): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(o.startHz, t);
  osc.frequency.exponentialRampToValueAtTime(o.endHz, t + o.dropSec);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.level, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + o.decaySec);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + o.decaySec + 0.02);
  cleanupOnEnd(osc, g);
}

export interface HatOpts {
  hpfHz: number;     // everything below this is thrown away: 8 kHz closed, 6 kHz open
  sec: number;       // 40 ms closed, 120 ms open
  level: number;
}

// Hat: a slice of noise above hpfHz with a 2 ms attack and an exponential decay.
export function hat(ctx: AudioContext, dest: AudioNode, t: number, o: HatOpts): void {
  const burst = noiseBurst(ctx, t, o.sec);
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = o.hpfHz;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.level, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, t + o.sec);
  burst.connect(hpf).connect(g).connect(dest);
  cleanupOnEnd(burst, hpf, g);
}

// Snare: 120 ms of noise through a band-pass at 1.8 kHz plus a 180 Hz sine
// body that lasts 90 ms. Same recipe as the lofi source.
export function snare(ctx: AudioContext, dest: AudioNode, t: number, level: number): void {
  const burst = noiseBurst(ctx, t, 0.12);
  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 1800;
  bpf.Q.value = 1;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(level, t + 0.003);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  burst.connect(bpf).connect(ng).connect(dest);
  cleanupOnEnd(burst, bpf, ng);

  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.value = 180;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0, t);
  bg.gain.linearRampToValueAtTime(level * 0.65, t + 0.003);
  bg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  body.connect(bg).connect(dest);
  body.start(t);
  body.stop(t + 0.1);
  cleanupOnEnd(body, bg);
}

// Gated snare (the 80s room): a wide noise burst through a band-pass at
// 1.5 kHz plus a 250 Hz sine body. The level is held for `gateSec` (90 ms)
// and then cut in 10 ms, which is the "gate" closing on the room. The dry
// hit goes to `dest`; a hotter copy goes to `send` (the reverb input) so the
// room blooms and is chopped with the gate.
export function gatedSnare(ctx: AudioContext, dest: AudioNode, send: AudioNode, t: number, level: number, gateSec = 0.09): void {
  const gate = ctx.createGain();
  gate.gain.setValueAtTime(0, t);
  gate.gain.linearRampToValueAtTime(1, t + 0.003);
  gate.gain.setValueAtTime(1, t + gateSec);
  gate.gain.linearRampToValueAtTime(0, t + gateSec + 0.01);

  const burst = noiseBurst(ctx, t, gateSec + 0.02);
  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 1500;
  bpf.Q.value = 0.5;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(level, t);
  ng.gain.exponentialRampToValueAtTime(level * 0.5, t + gateSec);   // slight sag inside the gate, still not a tail
  burst.connect(bpf).connect(ng).connect(gate);

  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.value = 250;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0, t);
  bg.gain.linearRampToValueAtTime(level * 0.7, t + 0.003);
  bg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  body.connect(bg).connect(gate);
  body.start(t);
  body.stop(t + gateSec + 0.02);

  const sendGain = ctx.createGain();
  sendGain.gain.value = 0.8;
  gate.connect(dest);
  gate.connect(sendGain).connect(send);
  cleanupOnEnd(burst, bpf, ng, body, bg, gate, sendGain);
}

// Clap: three 12 ms noise bursts 10 ms apart through a band-pass at 1.2 kHz,
// the last one with an 80 ms tail. The spacing is what makes it read as
// several hands instead of a snare.
export function clap(ctx: AudioContext, dest: AudioNode, t: number, level: number): void {
  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 1200;
  bpf.Q.value = 1.2;
  bpf.connect(dest);
  for (let i = 0; i < 3; i++) {
    const at = t + i * 0.01;
    const tail = i === 2 ? 0.08 : 0.012;
    const burst = noiseBurst(ctx, at, tail);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, at + tail);
    burst.connect(g).connect(bpf);
    // The band-pass is shared by the three bursts; the last one frees it.
    if (i === 2) cleanupOnEnd(burst, g, bpf); else cleanupOnEnd(burst, g);
  }
}
