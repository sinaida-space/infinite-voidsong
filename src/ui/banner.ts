// Infinite Voidsong — notice banner
//
// A single-line notice, dismissible, pinned to the bottom of the viewport.
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
  text.textContent = 'This site keeps your settings in your browser and nothing else.';

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
  dismiss.addEventListener('click', () => {
    banner.hidden = true;
    onDismiss?.();
  });

  actions.appendChild(dismiss);
  banner.appendChild(text);
  banner.appendChild(actions);
  root.appendChild(banner);

  return banner;
}
