// Tints the browser's own toolbars red.
//
// Safari 15 to 18 (and Chrome on Android) read `<meta name="theme-color">`,
// which every page sets. Safari 26 dropped that tag: it now looks for a
// `position: fixed` element hugging the top and the bottom edge of the
// viewport and takes its background colour. These two strips are that
// element. They are never painted (`visibility: hidden` does not stop Safari
// from sampling them), take no clicks, and are hidden from screen readers.

export function mountTint(): void {
  if (typeof document === 'undefined' || document.querySelector('.browser-tint')) return;
  for (const edge of ['top', 'bottom'] as const) {
    const strip = document.createElement('div');
    strip.className = `browser-tint browser-tint--${edge}`;
    strip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(strip);
  }
}
