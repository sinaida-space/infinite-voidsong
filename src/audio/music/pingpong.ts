// Ping-pong delay for the berlin sequence: two delay lines, one per channel,
// that feed each other so every repeat jumps to the other side. The delay
// time is a fraction of the beat (3/16 for berlin) and follows the tempo.
import { ramp, type NodeBag } from './util';

export interface PingPong {
  input: AudioNode;
  output: AudioNode;
  setTime(sec: number, at: number, rampSec: number): void;
}

export function makePingPong(ctx: AudioContext, bag: NodeBag, timeSec: number, feedback: number, wet: number): PingPong {
  const input = bag.add(ctx.createGain());
  const left = bag.add(ctx.createDelay(2));
  const right = bag.add(ctx.createDelay(2));
  left.delayTime.value = timeSec;
  right.delayTime.value = timeSec;
  // Feedback gains sit on the cross-connections: L -> R and R -> L. The dry
  // input enters the left line only, so the first repeat is on the left, the
  // second on the right, and so on.
  const fbLR = bag.add(ctx.createGain());
  const fbRL = bag.add(ctx.createGain());
  fbLR.gain.value = feedback;
  fbRL.gain.value = feedback;
  input.connect(left);
  left.connect(fbLR).connect(right);
  right.connect(fbRL).connect(left);
  // Repeats above 5 kHz are rolled off so the tail sits behind the dry voice.
  const tone = bag.add(ctx.createBiquadFilter());
  tone.type = 'lowpass';
  tone.frequency.value = 5000;
  const merger = bag.add(ctx.createChannelMerger(2));
  left.connect(merger, 0, 0);
  right.connect(merger, 0, 1);
  const output = bag.add(ctx.createGain());
  output.gain.value = wet;
  merger.connect(tone).connect(output);
  return {
    input,
    output,
    setTime(sec, at, rampSec) {
      // A ramped delay time bends the pitch of what is in the line for a moment;
      // tempo changes are rare and the bend reads as tape, so this is fine.
      ramp(left.delayTime, sec, at, rampSec);
      ramp(right.delayTime, sec, at, rampSec);
    },
  };
}
