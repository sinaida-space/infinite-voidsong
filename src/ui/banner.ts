// Infinite Voidsong — notice banner
//
// A single-line notice, pinned to the bottom of the viewport. It is information
// only (the site sets no cookies and asks for no consent), so it slides down out
// of the way as soon as the visitor scrolls, or on "Got it".
// The caller owns persistence: `onDismiss` fires once, when the visitor
// dismisses the banner, and the caller decides where that state lives
// (store, localStorage, …). This module has no dependency on the store.

export interface MountBannerOptions {
  /** Called once when the visitor dismisses the banner. */
  onDismiss?: () => void;
  /** When true, the banner mounts already hidden (e.g. previously dismissed). */
  initiallyDismissed?: boolean;
}

export function mountBanner(root: HTMLElement, options: MountBannerOptions = {}): HTMLElement {
  const { onDismiss, initiallyDismissed = false } = options;

  const banner = document.createElement('div');
  banner.className = 'notice-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Privacy notice');
  if (initiallyDismissed) {
    banner.hidden = true;
  }

  const text = document.createElement('p');
  text.className = 'notice-banner__text';
  text.textContent = 'This site keeps your settings and its own files in your browser and nothing else.';

  const privacyLink = document.createElement('a');
  privacyLink.href = '/privacy.html';
  privacyLink.textContent = 'Privacy';
  text.appendChild(privacyLink);

  const actions = document.createElement('div');
  actions.className = 'notice-banner__actions';

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'notice-banner__dismiss';
  dismiss.textContent = 'Got it';
  // Leave with a slide down; without motion (or if the transition never fires) just hide.
  let leaving = false;
  const leave = (): void => {
    if (leaving) return;
    leaving = true;
    window.removeEventListener('scroll', onScroll);
    onDismiss?.();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { banner.hidden = true; return; }
    banner.classList.add('notice-banner--leaving');
    const done = (): void => { banner.hidden = true; };
    banner.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 600);
  };
  const startY = window.scrollY;
  const onScroll = (): void => { if (Math.abs(window.scrollY - startY) > 40) leave(); };
  if (!initiallyDismissed) window.addEventListener('scroll', onScroll, { passive: true });
  dismiss.addEventListener('click', leave);

  actions.appendChild(dismiss);
  banner.appendChild(text);
  banner.appendChild(actions);
  root.appendChild(banner);

  return banner;
}
