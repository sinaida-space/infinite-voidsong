// crossfade.ts — click-free parameter ramps.
//
// Every ramp starts by cancelling pending automation and pinning the value
// the param actually has right now, so a fade interrupted by another fade
// continues from the current level instead of jumping. Equal-power fades
// follow a sin (in) / cos (out) law approximated by four linear segments;
// linear segments are used instead of setValueCurveAtTime because a curve
// cannot be interrupted safely in every browser.

const SEGMENTS = 4;

/** Cancel future automation and hold the present value at `at`. Returns it. */
export function hold(param: AudioParam, at: number): number {
  const v = param.value;
  param.cancelScheduledValues(at);
  param.setValueAtTime(v, at);
  return v;
}

/** Linear ramp from the current value to `target` over `dur` seconds. */
export function rampTo(param: AudioParam, target: number, at: number, dur: number): void {
  hold(param, at);
  if (dur <= 0) { param.setValueAtTime(target, at); return; }
  param.linearRampToValueAtTime(target, at + dur);
}

/** Equal-power fade-in: value follows sin(θ) from current to `to`. */
export function fadeIn(param: AudioParam, at: number, dur: number, to = 1): void {
  const from = hold(param, at);
  for (let k = 1; k <= SEGMENTS; k++) {
    const s = Math.sin((k / SEGMENTS) * Math.PI / 2);
    param.linearRampToValueAtTime(from + (to - from) * s, at + dur * k / SEGMENTS);
  }
}

/** Equal-power fade-out: value follows cos(θ) from current to `to` (default 0). */
export function fadeOut(param: AudioParam, at: number, dur: number, to = 0): void {
  const from = hold(param, at);
  for (let k = 1; k <= SEGMENTS; k++) {
    const c = Math.cos((k / SEGMENTS) * Math.PI / 2);
    param.linearRampToValueAtTime(to + (from - to) * c, at + dur * k / SEGMENTS);
  }
}
