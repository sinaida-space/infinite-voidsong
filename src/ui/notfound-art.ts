// Infinite Voidsong — 404 artwork picker
//
// Picks one of the pre-dithered PNGs in /404/ (built by scripts/dither-404.mjs)
// at random and drops it into the page. The manifest is a plain JSON array
// of filenames written alongside the images at build time.

async function mountNotFoundArt(): Promise<void> {
  const img = document.getElementById('notfound-image') as HTMLImageElement | null;
  if (!img) return;

  try {
    const res = await fetch('/404/manifest.json');
    if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
    const names: string[] = await res.json();
    if (!Array.isArray(names) || names.length === 0) throw new Error('empty manifest');

    const pick = names[Math.floor(Math.random() * names.length)];
    img.src = `/404/${pick}`;

    // A small secret: the monster opens a hidden game (loaded only when it is asked for).
    const open = (): void => { void import('./pacman').then((m) => m.openPacman()); };
    img.style.cursor = 'pointer';
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.addEventListener('click', open);
    img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  } catch {
    // No artwork today — the panel still reads fine without it.
    img.remove();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountNotFoundArt);
} else {
  mountNotFoundArt();
}
