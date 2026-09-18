// Infinite Voidsong — site footer
//
// Compact credit line: author, privacy, shortcuts, source, version.
// `__APP_VERSION__` is injected at build time from package.json (see the
// `define` block appended to vite.config.ts).

declare const __APP_VERSION__: string;

export function mountFooter(root: HTMLElement): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';

  const row = document.createElement('div');
  row.className = 'site-footer__row';

  const author = document.createElement('a');
  author.href = 'https://sinaida.eu';
  author.rel = 'noopener noreferrer';
  author.target = '_blank';
  author.textContent = 'Made by Sinaida Krivchenko';

  const privacy = document.createElement('a');
  privacy.href = '/privacy';
  privacy.textContent = 'Privacy';

  const shortcuts = document.createElement('a');
  shortcuts.href = '/shortcuts';
  shortcuts.textContent = 'Shortcuts';

  const github = document.createElement('a');
  github.href = 'https://github.com/sinaida-space/infinite-voidsong';
  github.rel = 'noopener noreferrer';
  github.target = '_blank';
  github.textContent = 'GitHub';

  const version = document.createElement('span');
  version.textContent = `v${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'}`;

  const items = [author, privacy, shortcuts, github, version];
  items.forEach((item, index) => {
    row.appendChild(item);
    if (index < items.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'site-footer__sep';
      sep.textContent = '·';
      sep.setAttribute('aria-hidden', 'true');
      row.appendChild(sep);
    }
  });

  footer.appendChild(row);
  root.appendChild(footer);
  return footer;
}

// Legal pages (privacy, shortcuts, 404) mount the footer standalone here;
// the main app mounts it itself via task 9's main.ts.
if (typeof document !== 'undefined') {
  const boot = () => {
    const root = document.getElementById('footer-root');
    if (root) mountFooter(root);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
