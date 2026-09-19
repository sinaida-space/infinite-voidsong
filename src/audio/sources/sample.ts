// sample.ts — recorded loops with a synthesized fallback.
//
//   sampleLayer(id, file, fallback)  →  SourceFactory
//
// While the file is loading (or if it never loads) the fallback synth plays.
// When the decoded buffer is ready the synth crossfades into the recording
// over 3 s, then is disposed. The recording loops as a chain of passes:
// two players of the same buffer overlap for XFADE seconds with equal-power
// gains (cos out / sin in), and every pass starts at a random offset inside
// the first half of the file. No `loop = true`, so there is no hard seam.
//
//   pass n   ──────────────╲
//   pass n+1          ╱──────────────╲      (starts at end − XFADE)
//
// The decoded AudioBuffer (about 21 MB of RAM per 56 s stereo loop) is shared by
// every layer that plays the file, decoded once even when two layers ask at the
// same time, and dropped a minute after the last layer stops using it. Files are
// fetched from /audio/<file>; the service worker keeps them in its own cache.
import { FAMILY_OF, type SourceId } from '../../state/types';
import { fadeIn, fadeOut } from '../crossfade';
import { dB } from '../dsp';
import { BaseSource, type SoundSource, type SourceFactory } from '../source';

const XFADE = 3;              // seconds: the synth → sample swap and the pass overlap
const CURVE_POINTS = 32;      // resolution of the equal-power gain curves

const RELEASE_MS = 60_000;    // a released buffer stays this long, so toggling a layer back on is instant

interface Entry { buf?: AudioBuffer; loading?: Promise<AudioBuffer | null>; refs: number; timer?: ReturnType<typeof setTimeout> }
const entries = new Map<string, Entry>();

function acquire(file: string): Entry {
  let e = entries.get(file);
  if (!e) { e = { refs: 0 }; entries.set(file, e); }
  e.refs++;
  if (e.timer !== undefined) { clearTimeout(e.timer); e.timer = undefined; }
  return e;
}

function release(file: string, e: Entry): void {
  if (--e.refs > 0) return;
  e.timer = setTimeout(() => { if (e.refs === 0 && entries.get(file) === e) entries.delete(file); }, RELEASE_MS);
}

async function fetchAndDecode(ctx: AudioContext, file: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(`/audio/${file}`);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;               // offline, blocked or undecodable: the synth keeps playing
  }
}

// Equal-power curves: rising sin, falling cos.
const CURVE_IN = new Float32Array(CURVE_POINTS);
const CURVE_OUT = new Float32Array(CURVE_POINTS);
for (let i = 0; i < CURVE_POINTS; i++) {
  const a = (i / (CURVE_POINTS - 1)) * Math.PI / 2;
  CURVE_IN[i] = Math.sin(a);
  CURVE_OUT[i] = Math.cos(a);
}

const saveData = (): boolean => {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!c?.saveData;
};

// Per-slot variation. The buffer is shared, so without this four Birds layers
// would play one recording four times. Each mixer slot gets its own colour of
// the same file: a small pitch/speed offset, a stereo position and a
// brightness tilt (slot 0 is the recording as it is). A seeded jitter on top
// keeps the offsets from being round numbers and stable for a given file + slot.
const SLOT_RATE = [1, 0.955, 1.045, 0.985];   // playbackRate: about a quarter to a semitone apart
const SLOT_PAN = [0, -0.4, 0.4, -0.2];
const SLOT_TILT_DB = [0, -3, 2.5, -1.5];      // high shelf at 4 kHz

function seeded(file: string, slot: number): () => number {
  let h = 2166136261 ^ (slot * 7919);
  for (let i = 0; i < file.length; i++) h = Math.imul(h ^ file.charCodeAt(i), 16777619);
  return () => {                              // mulberry32
    h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Pass { src: AudioBufferSourceNode; gain: GainNode }

class SampleSource extends BaseSource {
  private fallbackSrc: SoundSource | null = null;
  private synthGain: GainNode | null = null;
  private readonly sampleGain: GainNode;
  private readonly entry: Entry;
  private disposed = false;
  private readonly passes = new Set<Pass>();
  private buffer: AudioBuffer | null = null;
  private nextPass = -1;
  private synthUntil = -1;            // audio time after which the fallback can be disposed
  private firstPass = true;
  private readonly sampleLevel: number;
  private readonly rate: number;
  private readonly voice: BiquadFilterNode;   // slot brightness tilt, the entry of the sample path

  constructor(
    id: SourceId,
    private readonly file: string,
    fallback: SourceFactory,
    ctx: AudioContext,
    trimDb: number,
    slot: number,
  ) {
    // The trim lives on the sample path only: the fallback synth is already at nominal level.
    super(id, FAMILY_OF[id as Exclude<SourceId, 'none'>], ctx, 0);
    this.sampleLevel = dB(trimDb);
    this.sampleGain = this.own(new GainNode(ctx, { gain: this.sampleLevel }));
    this.sampleGain.connect(this.env);

    const s = slot % SLOT_RATE.length;
    const rnd = seeded(file, slot);
    this.rate = SLOT_RATE[s] * (1 + (rnd() - 0.5) * 0.014);
    this.voice = this.own(new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 4000, gain: SLOT_TILT_DB[s] + (rnd() - 0.5) }));
    const pan = this.own(new StereoPannerNode(ctx, { pan: SLOT_PAN[s] }));
    this.voice.connect(pan).connect(this.sampleGain);

    this.entry = acquire(file);
    if (this.entry.buf) {
      this.buffer = this.entry.buf;               // already decoded: no synth needed
    } else {
      this.synthGain = this.own(new GainNode(ctx, { gain: 1 }));
      this.synthGain.connect(this.env);
      this.fallbackSrc = fallback(ctx);
      this.fallbackSrc.connect(this.synthGain);
      this.onStart((at) => this.fallbackSrc?.start(at));
      if (!saveData()) void this.load();
    }

    // Books passes and retires the fallback, on the audio clock.
    this.sched.add((from, to) => {
      if (this.fallbackSrc && this.synthUntil >= 0 && ctx.currentTime > this.synthUntil) this.dropFallback();
      if (!this.buffer) return;
      if (this.nextPass < 0) this.nextPass = Math.max(ctx.currentTime, from);
      if (this.nextPass < from - XFADE) this.nextPass = from;   // timer stalled: do not book a burst of past passes
      while (this.nextPass < to) this.nextPass += this.bookPass(this.nextPass);
    });
    this.onDispose(() => this.teardown());
  }

  override stop(at: number): void {
    this.fallbackSrc?.stop(at);
    super.stop(at);
  }

  private async load(): Promise<void> {
    const e = this.entry;
    const buf = await (e.loading ??= fetchAndDecode(this.ctx, this.file));
    if (!buf) { e.loading = undefined; return; }   // a later layer may retry
    e.buf = buf;
    if (!this.disposed) this.swapIn(buf);
  }

  /** Buffer ready while the synth is playing: crossfade synth → sample. */
  private swapIn(buf: AudioBuffer): void {
    const now = this.ctx.currentTime;
    this.sampleGain.gain.setValueAtTime(0, now);
    fadeIn(this.sampleGain.gain, now, XFADE, this.sampleLevel);
    if (this.synthGain) fadeOut(this.synthGain.gain, now, XFADE);
    this.synthUntil = now + XFADE + 0.2;
    this.buffer = buf;
  }

  private dropFallback(): void {
    const f = this.fallbackSrc;
    this.fallbackSrc = null;
    if (!f) return;
    f.dispose();
    this.synthGain?.disconnect();
    this.synthGain = null;
  }

  /**
   * Book one pass at audio time `t`. Returns how long until the next pass
   * should start (pass length minus the overlap).
   */
  private bookPass(t: number): number {
    const buf = this.buffer!;
    const offset = Math.random() * buf.duration / 2;
    const len = (buf.duration - offset) / this.rate;   // seconds of output, the rate stretches it
    const first = this.firstPass;
    this.firstPass = false;
    const src = new AudioBufferSourceNode(this.ctx, { buffer: buf, playbackRate: this.rate });
    const gain = new GainNode(this.ctx, { gain: first ? 1 : 0 });
    src.connect(gain).connect(this.voice);
    if (!first) gain.gain.setValueCurveAtTime(CURVE_IN, t, XFADE);
    gain.gain.setValueCurveAtTime(CURVE_OUT, t + len - XFADE, XFADE);
    const pass: Pass = { src, gain };
    this.passes.add(pass);
    src.onended = () => { src.disconnect(); gain.disconnect(); this.passes.delete(pass); };
    src.start(t, offset);
    src.stop(t + len + 0.05);
    return len - XFADE;
  }

  private teardown(): void {
    this.disposed = true;
    release(this.file, this.entry);
    this.dropFallback();
    for (const { src, gain } of this.passes) {
      src.onended = null;
      try { src.stop(); } catch { /* not started */ }
      src.disconnect();
      gain.disconnect();
    }
    this.passes.clear();
  }
}

/**
 * Wrap `fallback` so the layer plays `/audio/<file>` when it loads and the
 * synth otherwise. `trimDb` lifts the file (mastered at −20 LUFS) to the
 * synths' nominal level.
 */
export function sampleLayer(id: SourceId, file: string, fallback: SourceFactory, opts: { trimDb?: number } = {}): SourceFactory {
  return (ctx, layerIndex = 0) => new SampleSource(id, file, fallback, ctx, opts.trimDb ?? 8, layerIndex);
}
