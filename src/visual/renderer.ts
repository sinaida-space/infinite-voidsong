// TunnelRenderer: raw WebGL2, one fullscreen triangle, one fragment shader.
// Reads the bus only (audio:levels, visual:motion, state:changed); never touches the store.
// The rAF loop runs only while something moves: still, reduced motion and a hidden tab
// all stop it after one frame.

import type { AppState, Family } from '../state/types';
import type { Bus } from '../state/events';
import { deriveVisualWeights, normalizeWeights, type SourceWeights } from './families';
import { Reactive, type Motion } from './reactive';
import vertSrc from './shaders/tunnel.vert.glsl?raw';
import fragSrc from './shaders/tunnel.frag.glsl?raw';

const MAX_DPR = 1.5;
const HALF_RES_BELOW_PX = 600;   // mobile widths render at half resolution
const MAX_DT = 0.05;             // clamp after a stall so nothing jumps
const DITHER_SCALE = 2;          // dither cell size in device pixels (visible at dpr 1.5)
const DITHER_DEFAULT = 0.8;      // 0 smooth .. 1 fully dithered

const UNIFORMS = [
  'uRes', 'uTime', 'uTravel', 'uSpeed', 'uFamily', 'uLevels', 'uBeat',
  'uLineColor', 'uLineColorFar', 'uLineBright', 'uGrain', 'uWidthAdd', 'uDpr', 'uDither', 'uDitherScale',
] as const;
type UniformName = typeof UNIFORMS[number];

export class TunnelRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private loc: Partial<Record<UniformName, WebGLUniformLocation | null>> = {};

  private readonly reactive = new Reactive();
  private rafId: number | null = null;
  private lastFrame = 0;         // performance.now() of the previous frame
  private time = 0;              // animated seconds (frozen when still / reduced motion)
  private travel = 0;            // ∫ speed dt
  private dpr = 1;
  private dither = DITHER_DEFAULT;
  private hidden = document.visibilityState === 'hidden';
  private observer: ResizeObserver | null = null;
  private readonly unsubscribe: Array<() => void> = [];
  private destroyed = false;

  constructor(private readonly canvas: HTMLCanvasElement, bus: Bus) {
    this.initGL();
    this.resize();

    this.observer = new ResizeObserver(() => { this.resize(); this.requestFrame(); });
    this.observer.observe(canvas);

    this.unsubscribe.push(
      bus.on('audio:levels', (l) => this.reactive.onLevels(l)),
      bus.on('visual:motion', (m) => this.setMotion(m)),
      bus.on('state:changed', ({ next }) => this.applyState(next)),
    );

    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);

    this.requestFrame();
  }

  /** Family weights (any subset; normalised to 1), crossfaded internally over 3 s. */
  setFamilies(weights: Partial<Record<Family, number>>): void {
    this.reactive.setFamilies(normalizeWeights(weights));
    this.requestFrame();
  }

  /** Music source weights (any subset, e.g. { synthwave: 1 }); they colour the music
   *  family's share of the tunnel and crossfade internally over 3 s. */
  setSources(weights: SourceWeights): void {
    this.reactive.setSources(weights);
    this.requestFrame();
  }

  /** running | decelerating (8 s ease-out, then still) | still (one frame, loop stops). */
  setMotion(m: Motion): void {
    this.reactive.setMotion(m);
    this.requestFrame();
  }

  /** Static frame: the time uniforms stop advancing until this is switched off. */
  setReducedMotion(on: boolean): void {
    this.reactive.reducedMotion = on;
    this.requestFrame();
  }

  /** Dither amount 0..1: 0 smooth shading, 1 fully ordered-dithered to 6 levels. */
  setDither(v: number): void {
    this.dither = Math.min(1, Math.max(0, Number.isFinite(v) ? v : DITHER_DEFAULT));
    this.requestFrame();
  }

  destroy(): void {
    this.destroyed = true;
    this.stopLoop();
    this.unsubscribe.forEach((off) => off());
    this.unsubscribe.length = 0;
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    const gl = this.gl;
    if (gl) {
      if (this.program) gl.deleteProgram(this.program);
      if (this.vao) gl.deleteVertexArray(this.vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.gl = null;
    this.program = null;
    this.vao = null;
  }

  // --- bus -------------------------------------------------------------------

  private applyState(next: AppState): void {
    const { families, sources } = deriveVisualWeights(next);
    this.reactive.setFamilies(normalizeWeights(families));
    this.reactive.setSources(sources);
    this.reactive.reducedMotion = next.reducedMotion;
    this.requestFrame();
  }

  private onVisibility = (): void => {
    this.hidden = document.visibilityState === 'hidden';
    if (this.hidden) this.stopLoop();
    else this.requestFrame();
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.stopLoop();
    this.program = null;
    this.vao = null;
  };

  private onContextRestored = (): void => {
    this.initGL();
    this.resize();
    this.requestFrame();
  };

  // --- GL setup ----------------------------------------------------------------

  private initGL(): void {
    const gl = this.gl ?? this.canvas.getContext('webgl2', {
      // true: the rAF loop stops entirely while `still` (see tick()/animating), so without this
      // the browser is free to clear the drawing buffer on the next composite and the tunnel
      // goes black on pause/after deceleration instead of holding its last frame.
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power',
    });
    if (!gl) { console.warn('[voidsong] WebGL2 unavailable; tunnel disabled'); return; }
    this.gl = gl;

    const vs = compile(gl, gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[voidsong] program link failed', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return;
    }
    this.program = program;
    for (const name of UNIFORMS) this.loc[name] = gl.getUniformLocation(program, name);

    // One triangle that covers clip space; the fragment shader ignores the overhang.
    const vao = gl.createVertexArray();
    const buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.vao = vao;

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1);
  }

  private resize(): void {
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    if (cssW < HALF_RES_BELOW_PX) dpr *= 0.5;
    this.dpr = dpr;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  // --- loop ----------------------------------------------------------------------

  /** Draws on the next animation frame; keeps going only while Reactive says it must. */
  private requestFrame(): void {
    if (this.destroyed || this.hidden || this.rafId !== null) return;
    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private tick = (now: number): void => {
    this.rafId = null;
    const dt = Math.min(MAX_DT, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.draw(dt);
    if (this.reactive.animating && !this.hidden && !this.destroyed) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  private draw(dt: number): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.vao) return;
    const p = this.reactive.update(dt);

    // Time advances only while the picture is allowed to move.
    const moving = !this.reactive.reducedMotion && this.reactive.motion !== 'still';
    if (moving) {
      this.time += dt;
      this.travel += p.speed * dt;
    }

    const L = this.loc;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.uniform2f(L.uRes!, this.canvas.width, this.canvas.height);
    gl.uniform1f(L.uTime!, this.time);
    gl.uniform1f(L.uTravel!, this.travel);
    gl.uniform1f(L.uSpeed!, p.speed);
    gl.uniform1fv(L.uFamily!, p.weights);
    gl.uniform4f(L.uLevels!, p.levels[0], p.levels[1], p.levels[2], p.levels[3]);
    gl.uniform1f(L.uBeat!, p.beat);
    gl.uniform3f(L.uLineColor!, p.hue[0], p.hue[1], p.hue[2]);
    gl.uniform3f(L.uLineColorFar!, p.hueFar[0], p.hueFar[1], p.hueFar[2]);
    gl.uniform1f(L.uLineBright!, p.lineBright);
    gl.uniform1f(L.uGrain!, p.grain);
    gl.uniform1f(L.uWidthAdd!, p.widthAdd);
    gl.uniform1f(L.uDpr!, this.dpr);
    gl.uniform1f(L.uDither!, this.dither);
    gl.uniform1f(L.uDitherScale!, DITHER_SCALE);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[voidsong] shader compile failed', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
