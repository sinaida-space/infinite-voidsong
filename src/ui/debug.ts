// debug.ts — an on-screen status panel for phones, shown only at /?debug.
//
// Shows the AudioContext state, WebGL context loss, recording fetches and any
// uncaught error, so a screenshot from a phone says what is failing. Nothing
// is stored or sent. It must be imported first: it wraps AudioContext and
// fetch before the engine creates them.

const on = /[?&]debug\b/.test(location.search);

if (on) {
  const rows = new Map<string, string>();
  const log: string[] = [];
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:6px;right:6px;top:70px;z-index:2147483647;margin:0;padding:8px;background:rgba(0,0,0,.85);color:#7CFC00;font:11px/1.35 monospace;white-space:pre-wrap;pointer-events:none;max-height:45vh;overflow:hidden';
  const render = (): void => {
    box.textContent = [...rows].map(([k, v]) => `${k}: ${v}`).join('\n') + (log.length ? '\n--\n' + log.slice(-8).join('\n') : '');
  };
  const set = (k: string, v: string): void => { rows.set(k, v); render(); };
  const add = (s: string): void => { log.push(s.slice(0, 140)); render(); };
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(box));

  set('ua', navigator.userAgent.replace(/^Mozilla\/5.0 /, '').slice(0, 70));
  set('screen', `${innerWidth}x${innerHeight} dpr${devicePixelRatio}`);
  window.addEventListener('error', (e) => add('ERR ' + e.message));
  window.addEventListener('unhandledrejection', (e) => add('REJ ' + String((e.reason && e.reason.message) || e.reason)));
  const warn = console.warn.bind(console);
  console.warn = (...a: unknown[]) => { add('WARN ' + a.join(' ')); warn(...a); };
  document.addEventListener('visibilitychange', () => add('vis ' + document.visibilityState));

  // Audio: track every AudioContext.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  const Orig = window.AudioContext;
  if (Orig) {
    window.AudioContext = class extends Orig {
      constructor(o?: AudioContextOptions) {
        super(o);
        set('audio', `${this.state} ${this.sampleRate} Hz`);
        this.addEventListener('statechange', () => { set('audio', `${this.state} ${this.sampleRate} Hz`); add('audio ' + this.state); });
        setInterval(() => { set('audio time', this.currentTime.toFixed(1) + ' s'); set('audioSession', session ? session.type : 'n/a'); }, 1000);
      }
    };
  } else set('audio', 'no AudioContext');
  set('audioSession', session ? session.type : 'n/a');

  // Recordings.
  const f = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const p = f(input, init);
    if (url.includes('/audio/')) {
      const name = url.split('/').pop();
      p.then((r) => add(`fetch ${name} ${r.status}`), (e) => add(`fetch ${name} FAIL ${e}`));
    }
    return p;
  };

  // WebGL.
  document.addEventListener('DOMContentLoaded', () => {
    const c = document.getElementById('tunnel') as HTMLCanvasElement | null;
    if (!c) return set('webgl', 'no canvas');
    c.addEventListener('webglcontextlost', () => add('GL context LOST'));
    c.addEventListener('webglcontextrestored', () => add('GL context restored'));
    setInterval(() => {
      const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
      let px = '';
      try {
        const t = document.createElement('canvas'); t.width = 4; t.height = 4;
        const x = t.getContext('2d')!; x.drawImage(c, 0, 0, 4, 4);
        const d = x.getImageData(0, 0, 4, 4).data; let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        px = ` px=${Math.round(r / 16)},${Math.round(g / 16)},${Math.round(b / 16)}`;
      } catch { px = ' px=?'; }
      set('webgl', gl ? (gl.isContextLost() ? 'LOST' : 'ok') + ` ${c.width}x${c.height} data-gl=${document.documentElement.dataset.gl ?? '-'}${px}` : 'none');
    }, 1000);
  });
}
