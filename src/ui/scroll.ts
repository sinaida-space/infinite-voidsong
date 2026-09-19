// Every page opens at the very top.
//
// Browsers restore the previous scroll position on a reload or when you come
// back to a page, and layout that settles late (fonts, the canvas, the dialog)
// can also leave a page scrolled part way down. Both are wrong for this site:
// a page is always read from its start. Restoration is switched off, the page
// is put at the top on load and after layout settles, and when Safari revives
// a page from its back-forward cache.

export function startAtTop(): void {
  if (typeof window === 'undefined') return;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const top = (): void => window.scrollTo(0, 0);
  // A link to a section (#something) is the one time the position is meant to stay.
  const wantsAnchor = (): boolean => location.hash.length > 1;

  const reset = (): void => {
    if (!wantsAnchor()) top();
  };

  reset();
  requestAnimationFrame(reset);
  window.addEventListener('DOMContentLoaded', reset, { once: true });
  window.addEventListener('load', () => {
    reset();
    // Late layout (web fonts, the first frame of the tunnel) can shift things once more.
    setTimeout(reset, 120);
  }, { once: true });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) reset(); // restored from the back-forward cache
  });
}

startAtTop();
