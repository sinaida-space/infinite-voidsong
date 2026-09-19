// Rare dithered stars for the welcome screen background.
//
// A small canvas drawn in coarse cells. Every second or so a star fades in at
// a random spot, holds, and fades out. Brightness is turned into cells with a
// 4×4 ordered (Bayer) threshold, so the fade reads as dither, not as a smooth
// glow. Under reduced motion a few stars are drawn once and nothing moves.

const CELL = 3;            // CSS pixels per canvas cell
const FRAME_MS = 50;       // redraw at 20 fps: the cells are chunky anyway
const SPAWN_EVERY_MS = 900;
const LIFE_MS = 3600;
const MAX_STARS = 7;

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Plus-shaped star: centre, four near arms, four far arm tips (weights 0..1).
const SHAPE: Array<[number, number, number]> = [
  [0, 0, 1], [1, 0, 0.75], [-1, 0, 0.75], [0, 1, 0.75], [0, -1, 0.75],
  [2, 0, 0.45], [-2, 0, 0.45], [0, 2, 0.45], [0, -2, 0.45],
];

interface Star {
  x: number;
  y: number;
  born: number;
  red: boolean;
}

export interface Stars {
  canvas: HTMLCanvasElement;
  stop: () => void;
}

export function createStars(reducedMotion: boolean): Stars {
  const canvas = document.createElement('canvas');
  canvas.className = 'term__stars';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');

  let cols = 1;
  let rows = 1;
  const resize = (): void => {
    cols = Math.max(1, Math.ceil(window.innerWidth / CELL));
    rows = Math.max(1, Math.ceil(window.innerHeight / CELL));
    canvas.width = cols;
    canvas.height = rows;
  };
  resize();
  window.addEventListener('resize', resize);

  const stars: Star[] = [];
  const spawn = (now: number, born = now): void => {
    stars.push({
      x: 3 + Math.floor(Math.random() * Math.max(1, cols - 6)),
      y: 3 + Math.floor(Math.random() * Math.max(1, rows - 6)),
      born,
      red: Math.random() < 0.25,
    });
  };

  const draw = (now: number): void => {
    if (!ctx) return;
    ctx.clearRect(0, 0, cols, rows);
    for (const s of stars) {
      const t = (now - s.born) / LIFE_MS;
      if (t < 0 || t > 1) continue;
      const envelope = Math.sin(Math.PI * t) ** 2; // fade in, hold, fade out
      ctx.fillStyle = s.red ? '#cd0000' : '#f6f6f6';
      for (const [dx, dy, w] of SHAPE) {
        const x = s.x + dx;
        const y = s.y + dy;
        const threshold = (BAYER_4X4[y & 3][x & 3] + 0.5) / 16;
        if (envelope * w > threshold) ctx.fillRect(x, y, 1, 1);
      }
    }
  };

  if (reducedMotion) {
    for (let i = 0; i < 6; i++) spawn(0, -LIFE_MS / 2);
    draw(0);
    return { canvas, stop: () => window.removeEventListener('resize', resize) };
  }

  let raf = 0;
  let last = 0;
  let nextSpawn = 0;
  const loop = (now: number): void => {
    raf = requestAnimationFrame(loop);
    if (now - last < FRAME_MS) return;
    last = now;
    for (let i = stars.length - 1; i >= 0; i--) {
      if (now - stars[i].born > LIFE_MS) stars.splice(i, 1);
    }
    if (now >= nextSpawn && stars.length < MAX_STARS) {
      spawn(now);
      nextSpawn = now + SPAWN_EVERY_MS * (0.6 + Math.random() * 0.9);
    }
    draw(now);
  };
  raf = requestAnimationFrame(loop);

  return {
    canvas,
    stop: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    },
  };
}
