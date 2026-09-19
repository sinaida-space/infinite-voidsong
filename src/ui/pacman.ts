// A hidden Pac-Man in a popup: opens from the wordmark on the app page and from
// the monster on the 404 page. Arrow keys or WASD steer; on a phone you swipe
// on the maze, so there is no extra on-screen control. Nothing is saved or sent
// anywhere: the best score lives only until the tab closes.

import '../styles/pacman.css';
import { shortcutKey } from './keys';

// --- maze -----------------------------------------------------------------------------
// # wall   . pellet   o power pellet   - ghost door   P Pac-Man start   (space) empty
const MAP = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.### # ###.####',
  '####.#       #.####',
  '####.# ##-## #.####',
  '    .  #   #  .    ',
  '####.# ##### #.####',
  '####.#       #.####',
  '####.# ##### #.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.....P.....#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
];
const COLS = 19;
const ROWS = 21;
const TUNNEL_ROW = 9;
const DOOR = { x: 9, y: 8 };
const ABOVE_DOOR = { x: 9, y: 7 };
const HOUSE = { x: 9, y: 9 };

interface Dir { dx: number; dy: number }
const UP: Dir = { dx: 0, dy: -1 };
const DOWN: Dir = { dx: 0, dy: 1 };
const LEFT: Dir = { dx: -1, dy: 0 };
const RIGHT: Dir = { dx: 1, dy: 0 };
const NONE: Dir = { dx: 0, dy: 0 };
const DIRS = [UP, LEFT, DOWN, RIGHT];
const same = (a: Dir, b: Dir): boolean => a.dx === b.dx && a.dy === b.dy;
const opposite = (a: Dir, b: Dir): boolean => a.dx === -b.dx && a.dy === -b.dy && (a.dx !== 0 || a.dy !== 0);

// Brand colours (see tokens.css).
const RED = '#cd0000';
const CHALK = '#f6f6f6';
const CATHODE = '#a7bebe';
const AMBER = '#e08a1e';
const SCARED = '#3a7bd5';

type GhostMode = 'house' | 'exit' | 'chase' | 'scared' | 'eaten';

interface Mover {
  tx: number; // the tile the mover is leaving (or standing on)
  ty: number;
  dir: Dir;
  progress: number; // 0..1 along `dir`
  moving: boolean;
}

interface Ghost extends Mover {
  color: string;
  mode: GhostMode;
  release: number; // seconds until it leaves the house
  skill: number;   // chance to take the shortest way to Pac-Man
  start: { x: number; y: number };
}

type Phase = 'ready' | 'playing' | 'dying' | 'cleared' | 'over';

const PAC_SPEED = 6.4;     // tiles per second
const GHOST_SPEED = 5.4;
const SCARED_SPEED = 3.4;
const EATEN_SPEED = 11;

export function openPacman(): void {
  if (document.querySelector('.pac')) return;

  // --- state -------------------------------------------------------------------------
  const grid = MAP.map((r) => r.split(''));
  let pellets: number[][] = [];
  let pelletsLeft = 0;
  let bestScore = bestThisSession;
  let score = 0;
  let lives = 3;
  let level = 1;
  let phase: Phase = 'ready';
  let phaseTime = 0;
  let clock = 0;
  let scaredTimer = 0;
  let ghostsEaten = 0;

  const pac: Mover & { want: Dir; face: Dir } = { tx: 9, ty: 15, dir: NONE, progress: 0, moving: false, want: NONE, face: LEFT };
  const ghosts: Ghost[] = [
    { color: RED, skill: 0.85, start: { x: 9, y: 9 }, release: 0.5, mode: 'house', tx: 9, ty: 9, dir: NONE, progress: 0, moving: false },
    { color: CATHODE, skill: 0.6, start: { x: 8, y: 9 }, release: 4, mode: 'house', tx: 8, ty: 9, dir: NONE, progress: 0, moving: false },
    { color: AMBER, skill: 0.4, start: { x: 10, y: 9 }, release: 8, mode: 'house', tx: 10, ty: 9, dir: NONE, progress: 0, moving: false },
  ];

  // --- maze helpers --------------------------------------------------------------------
  function tileAt(x: number, y: number): string {
    if (y < 0 || y >= ROWS) return '#';
    if (x < 0 || x >= COLS) return y === TUNNEL_ROW ? ' ' : '#';
    return grid[y][x];
  }
  const wrapX = (x: number): number => (x < 0 ? COLS - 1 : x >= COLS ? 0 : x);

  function canEnter(x: number, y: number, ghost: Ghost | null): boolean {
    const c = tileAt(x, y);
    if (c === '#') return false;
    if (c === '-') return !!ghost && (ghost.mode === 'exit' || ghost.mode === 'eaten');
    return true;
  }

  /** Shortest distances from a tile, walking the maze the way a ghost may (door open when `door`). */
  function distances(sx: number, sy: number, door: boolean): number[][] {
    const d = Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(Infinity));
    const queue: Array<[number, number]> = [[sx, sy]];
    d[sy][sx] = 0;
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const dir of DIRS) {
        const nx = wrapX(x + dir.dx);
        const ny = y + dir.dy;
        const c = tileAt(x + dir.dx, ny);
        if (c === '#' || (c === '-' && !door) || ny < 0 || ny >= ROWS) continue;
        if (d[ny][nx] === Infinity) {
          d[ny][nx] = d[y][x] + 1;
          queue.push([nx, ny]);
        }
      }
    }
    return d;
  }
  const toExit = distances(ABOVE_DOOR.x, ABOVE_DOOR.y, true);
  const toHouse = distances(HOUSE.x, HOUSE.y, true);
  let toPac = distances(9, 15, false);
  let lastPacTile = '';

  // --- setup / reset -------------------------------------------------------------------
  function resetMaze(): void {
    pellets = MAP.map((row) => row.split('').map((c) => (c === '.' ? 1 : c === 'o' ? 2 : 0)));
    // Drop any pellet Pac-Man could never reach, so a level can always be cleared.
    const reach = distances(9, 15, false);
    pelletsLeft = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (pellets[y][x] && reach[y][x] === Infinity) pellets[y][x] = 0;
        if (pellets[y][x]) pelletsLeft++;
      }
    }
  }

  function resetActors(): void {
    Object.assign(pac, { tx: 9, ty: 15, dir: NONE, progress: 0, moving: false, want: NONE, face: LEFT });
    ghosts.forEach((g, i) => {
      Object.assign(g, { tx: g.start.x, ty: g.start.y, dir: NONE, progress: 0, moving: false, mode: 'house' as GhostMode });
      g.release = [0.5, 4, 8][i] / (1 + (level - 1) * 0.15);
    });
    scaredTimer = 0;
    ghostsEaten = 0;
    lastPacTile = '';
  }

  resetMaze();

  // --- DOM ------------------------------------------------------------------------------
  const overlay = document.createElement('div');
  overlay.className = 'pac';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Pac-Man');

  const win = document.createElement('div');
  win.className = 'win pac__win';
  win.tabIndex = -1;

  const bar = document.createElement('div');
  bar.className = 'win__bar';
  const title = document.createElement('span');
  title.className = 'win__title';
  title.textContent = 'Pac-Void';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'win__close';
  close.setAttribute('aria-label', 'Close game');
  close.textContent = '×';
  bar.append(title, close);

  const body = document.createElement('div');
  body.className = 'win__body';
  const hud = document.createElement('p');
  hud.className = 'pac__hud';
  const canvas = document.createElement('canvas');
  canvas.className = 'pac__canvas';
  canvas.setAttribute('aria-label', 'Pac-Man game. Arrow keys or WASD to steer, swipe on a phone.');
  const hint = document.createElement('p');
  hint.className = 'pac__hint';
  hint.textContent = 'Arrows or WASD to steer. On a phone, swipe on the maze. Esc closes.';
  body.append(hud, canvas, hint);
  win.append(bar, body);
  overlay.appendChild(win);
  document.body.appendChild(overlay);
  document.documentElement.classList.add('pac-open');
  win.focus({ preventScroll: true });

  const ctx = canvas.getContext('2d')!;
  let cell = 20;
  let dpr = 1;

  function updateHud(): void {
    hud.textContent = `SCORE ${score}   LIVES ${'● '.repeat(Math.max(0, lives)).trim() || '-'}   BEST ${bestScore}`;
  }

  function fit(): void {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const maxW = Math.min(body.clientWidth || 420, 460);
    const maxH = window.innerHeight * 0.62;
    cell = Math.max(8, Math.floor(Math.min(maxW / COLS, maxH / ROWS)));
    canvas.style.width = `${cell * COLS}px`;
    canvas.style.height = `${cell * ROWS}px`;
    canvas.width = Math.round(cell * COLS * dpr);
    canvas.height = Math.round(cell * ROWS * dpr);
  }
  fit();
  updateHud();

  // --- movement -------------------------------------------------------------------------
  const pos = (m: Mover): { x: number; y: number } => ({ x: m.tx + m.dir.dx * m.progress, y: m.ty + m.dir.dy * m.progress });

  /** Advances a mover along the grid. `choose` is asked for a direction each time it stands on a tile centre. */
  function advance(m: Mover, distance: number, choose: () => Dir, onArrive: () => void): void {
    let left = distance;
    let guard = 8;
    while (left > 1e-6 && guard-- > 0) {
      if (!m.moving) {
        const d = choose();
        if (same(d, NONE)) { m.dir = NONE; m.progress = 0; return; }
        m.dir = d;
        m.moving = true;
        m.progress = 0;
      }
      const step = Math.min(left, 1 - m.progress);
      m.progress += step;
      left -= step;
      if (m.progress >= 1 - 1e-9) {
        m.tx = wrapX(m.tx + m.dir.dx);
        m.ty += m.dir.dy;
        m.progress = 0;
        m.moving = false;
        onArrive();
      }
    }
  }

  function choosePac(): Dir {
    if (!same(pac.want, NONE) && canEnter(pac.tx + pac.want.dx, pac.ty + pac.want.dy, null)) return pac.want;
    if (!same(pac.dir, NONE) && canEnter(pac.tx + pac.dir.dx, pac.ty + pac.dir.dy, null)) return pac.dir;
    return NONE;
  }

  function arrivePac(): void {
    const p = pellets[pac.ty]?.[pac.tx];
    if (p) {
      pellets[pac.ty][pac.tx] = 0;
      pelletsLeft--;
      score += p === 2 ? 50 : 10;
      if (p === 2) {
        scaredTimer = Math.max(2.5, 6.5 - level * 0.5);
        ghostsEaten = 0;
        for (const g of ghosts) if (g.mode === 'chase') { g.mode = 'scared'; reverse(g); }
      }
      if (score > bestScore) bestScore = bestThisSession = score;
      updateHud();
    }
    if (pelletsLeft <= 0) { phase = 'cleared'; phaseTime = 0; }
  }

  /** Turns a ghost round, e.g. when a power pellet frightens it. */
  function reverse(g: Ghost): void {
    if (!g.moving) return;
    g.tx = wrapX(g.tx + g.dir.dx);
    g.ty += g.dir.dy;
    g.progress = 1 - g.progress;
    g.dir = { dx: -g.dir.dx, dy: -g.dir.dy };
  }

  function chooseGhost(g: Ghost): Dir {
    const options = DIRS.filter((d) => canEnter(g.tx + d.dx, g.ty + d.dy, g) && !opposite(d, g.dir));
    const all = options.length ? options : DIRS.filter((d) => canEnter(g.tx + d.dx, g.ty + d.dy, g));
    if (!all.length) return NONE;
    const cost = (d: Dir, field: number[][]): number => field[g.ty + d.dy]?.[wrapX(g.tx + d.dx)] ?? Infinity;
    const best = (field: number[][]): Dir => all.reduce((a, b) => (cost(b, field) < cost(a, field) ? b : a));
    switch (g.mode) {
      case 'exit': return best(toExit);
      case 'eaten': return best(toHouse);
      case 'scared': return all[Math.floor(Math.random() * all.length)];
      default: return Math.random() < g.skill ? best(toPac) : all[Math.floor(Math.random() * all.length)];
    }
  }

  function arriveGhost(g: Ghost): void {
    if (g.mode === 'exit' && g.tx === ABOVE_DOOR.x && g.ty === ABOVE_DOOR.y) g.mode = scaredTimer > 0 ? 'scared' : 'chase';
    if (g.mode === 'eaten' && g.tx === HOUSE.x && g.ty === HOUSE.y) { g.mode = 'house'; g.release = 1.2; g.dir = NONE; }
  }

  // --- game flow ------------------------------------------------------------------------
  function start(): void {
    if (phase === 'over') { score = 0; lives = 3; level = 1; resetMaze(); resetActors(); updateHud(); }
    if (phase === 'ready' || phase === 'over') phase = 'playing';
    phaseTime = 0;
  }

  function update(dt: number): void {
    clock += dt;
    phaseTime += dt;

    if (phase === 'dying') {
      if (phaseTime > 1.4) {
        lives--;
        updateHud();
        if (lives <= 0) { phase = 'over'; } else { resetActors(); phase = 'ready'; }
        phaseTime = 0;
      }
      return;
    }
    if (phase === 'cleared') {
      if (phaseTime > 1.6) { level++; resetMaze(); resetActors(); phase = 'ready'; phaseTime = 0; }
      return;
    }
    if (phase !== 'playing') return;

    const speedUp = 1 + (level - 1) * 0.06;
    advance(pac, PAC_SPEED * speedUp * dt, choosePac, arrivePac);
    if (!same(pac.dir, NONE)) pac.face = pac.dir;

    const tile = `${pac.tx},${pac.ty}`;
    if (tile !== lastPacTile) { toPac = distances(pac.tx, pac.ty, false); lastPacTile = tile; }

    if (scaredTimer > 0) {
      scaredTimer -= dt;
      if (scaredTimer <= 0) for (const g of ghosts) if (g.mode === 'scared') g.mode = 'chase';
    }

    for (const g of ghosts) {
      if (g.mode === 'house') {
        g.release -= dt;
        if (g.release <= 0) g.mode = 'exit';
        continue;
      }
      const base = g.mode === 'eaten' ? EATEN_SPEED : g.mode === 'scared' ? SCARED_SPEED : GHOST_SPEED * speedUp;
      advance(g, base * dt, () => chooseGhost(g), () => arriveGhost(g));
    }

    // Meetings.
    const p = pos(pac);
    for (const g of ghosts) {
      if (g.mode === 'house' || g.mode === 'eaten') continue;
      const q = pos(g);
      if (Math.hypot(p.x - q.x, p.y - q.y) < 0.6) {
        if (g.mode === 'scared') {
          g.mode = 'eaten';
          ghostsEaten++;
          score += 200 * 2 ** (ghostsEaten - 1);
          if (score > bestScore) bestScore = bestThisSession = score;
          updateHud();
        } else {
          phase = 'dying';
          phaseTime = 0;
          return;
        }
      }
    }
  }

  // --- drawing --------------------------------------------------------------------------
  function drawMaze(): void {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = grid[y][x];
        const px = x * cell;
        const py = y * cell;
        if (c === '#') {
          ctx.fillStyle = 'rgba(205, 0, 0, 0.16)';
          ctx.fillRect(px, py, cell, cell);
          ctx.strokeStyle = RED;
          ctx.lineWidth = Math.max(1.5, cell * 0.09);
          ctx.beginPath();
          // An edge is drawn where a wall meets open floor.
          if (tileAt(x, y - 1) !== '#' && y > 0) { ctx.moveTo(px, py); ctx.lineTo(px + cell, py); }
          if (tileAt(x, y + 1) !== '#' && y < ROWS - 1) { ctx.moveTo(px, py + cell); ctx.lineTo(px + cell, py + cell); }
          if (tileAt(x - 1, y) !== '#' && x > 0) { ctx.moveTo(px, py); ctx.lineTo(px, py + cell); }
          if (tileAt(x + 1, y) !== '#' && x < COLS - 1) { ctx.moveTo(px + cell, py); ctx.lineTo(px + cell, py + cell); }
          ctx.stroke();
        } else if (c === '-') {
          ctx.fillStyle = CATHODE;
          ctx.fillRect(px, py + cell * 0.42, cell, cell * 0.16);
        }
        const p = pellets[y][x];
        if (p === 1) {
          ctx.fillStyle = CHALK;
          ctx.fillRect(px + cell * 0.42, py + cell * 0.42, cell * 0.16, cell * 0.16);
        } else if (p === 2 && Math.floor(clock * 3) % 2 === 0) {
          ctx.fillStyle = CHALK;
          ctx.beginPath();
          ctx.arc(px + cell / 2, py + cell / 2, cell * 0.26, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawPac(): void {
    const p = pos(pac);
    const cx = (p.x + 0.5) * cell;
    const cy = (p.y + 0.5) * cell;
    const r = cell * 0.44;
    const angle = Math.atan2(pac.face.dy, pac.face.dx);
    let mouth = 0.08 + 0.24 * Math.abs(Math.sin(clock * 14)) * (pac.moving || phase === 'ready' ? 1 : 0.3);
    if (phase === 'dying') mouth = Math.min(Math.PI, 0.3 + phaseTime * 2.4);
    ctx.fillStyle = CHALK;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle + mouth, angle + Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
  }

  function drawGhost(g: Ghost): void {
    const p = pos(g);
    const cx = (p.x + 0.5) * cell;
    const cy = (p.y + 0.5) * cell;
    const r = cell * 0.42;
    if (g.mode !== 'eaten') {
      const blink = g.mode === 'scared' && scaredTimer < 1.6 && Math.floor(clock * 6) % 2 === 0;
      ctx.fillStyle = g.mode === 'scared' ? (blink ? CHALK : SCARED) : g.color;
      const base = cy + r;
      const wave = Math.floor(clock * 8) % 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 0);
      ctx.lineTo(cx + r, base);
      const teeth = 3;
      const w = (2 * r) / (teeth * 2);
      for (let i = 0; i < teeth * 2; i++) {
        const x = cx + r - w * (i + 1);
        ctx.lineTo(x, base - (((i + wave) % 2) === 0 ? 0 : r * 0.3));
      }
      ctx.closePath();
      ctx.fill();
    }
    // Eyes look where the ghost is going.
    const look = same(g.dir, NONE) ? { dx: 0, dy: 0 } : g.dir;
    for (const ex of [-0.34, 0.34]) {
      ctx.fillStyle = CHALK;
      ctx.beginPath();
      ctx.arc(cx + ex * r * 1.2, cy - r * 0.15, r * 0.27, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#050505';
      ctx.beginPath();
      ctx.arc(cx + ex * r * 1.2 + look.dx * r * 0.12, cy - r * 0.15 + look.dy * r * 0.12, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMessage(text: string, sub?: string): void {
    ctx.fillStyle = 'rgba(5, 5, 5, 0.72)';
    ctx.fillRect(0, (ROWS / 2 - 2) * cell, COLS * cell, cell * 4);
    ctx.textAlign = 'center';
    ctx.fillStyle = RED;
    ctx.font = `${Math.round(cell * 1.5)}px "Geist Pixel", monospace`;
    ctx.fillText(text, (COLS * cell) / 2, (ROWS / 2) * cell);
    if (sub) {
      ctx.fillStyle = CHALK;
      ctx.font = `${Math.round(cell * 0.75)}px "Geist Pixel", monospace`;
      ctx.fillText(sub, (COLS * cell) / 2, (ROWS / 2 + 1.4) * cell);
    }
  }

  function draw(): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, COLS * cell, ROWS * cell);
    drawMaze();
    if (phase !== 'dying' || phaseTime < 0.4) ghosts.forEach(drawGhost);
    if (phase !== 'over') drawPac();
    if (phase === 'ready') drawMessage('READY', 'press a key or swipe');
    if (phase === 'cleared') drawMessage('CLEARED');
    if (phase === 'over') drawMessage('GAME OVER', 'space or tap to play again');
  }

  // --- loop -----------------------------------------------------------------------------
  let raf = 0;
  let last = performance.now();
  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
  };
  raf = requestAnimationFrame(frame);

  // --- input ----------------------------------------------------------------------------
  // Physical keys (see keys.ts), so WASD works on a Russian layout too: ц ф ы в.
  const KEYS: Record<string, Dir> = {
    ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT,
    w: UP, s: DOWN, a: LEFT, d: RIGHT,
  };

  function steer(d: Dir): void {
    pac.want = d;
    if (phase === 'ready') start();
    // Turning right round is allowed at once, mid-tile.
    if (pac.moving && opposite(d, pac.dir)) {
      pac.tx = wrapX(pac.tx + pac.dir.dx);
      pac.ty += pac.dir.dy;
      pac.progress = 1 - pac.progress;
      pac.dir = d;
    }
  }

  const onKey = (e: KeyboardEvent): void => {
    const key = shortcutKey(e);
    if (key === 'Escape') { e.preventDefault(); shut(); return; }
    const d = KEYS[key];
    if (d) { e.preventDefault(); steer(d); return; }
    if (key === ' ' || key === 'Enter') {
      if (e.target === close) return; // let the close button work
      e.preventDefault();
      if (phase === 'ready' || phase === 'over') start();
    }
  };

  // Swipes: a drag of a few dozen pixels picks a direction, and keeps steering as the finger moves on.
  let touchX = 0;
  let touchY = 0;
  let touching = false;
  const onTouchStart = (e: TouchEvent): void => {
    const t = e.touches[0];
    touchX = t.clientX;
    touchY = t.clientY;
    touching = true;
  };
  const onTouchMove = (e: TouchEvent): void => {
    if (!touching) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - touchX;
    const dy = t.clientY - touchY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP);
    touchX = t.clientX;
    touchY = t.clientY;
  };
  const onTouchEnd = (): void => { touching = false; };
  const onTap = (): void => { if (phase === 'ready' || phase === 'over') start(); };

  const onVisibility = (): void => { last = performance.now(); };
  const onResize = (): void => fit();

  function shut(): void {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    document.documentElement.classList.remove('pac-open');
    overlay.remove();
  }

  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('click', onTap);
  close.addEventListener('click', shut);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) shut(); });
}

// Best score of this tab only, never stored.
let bestThisSession = 0;
