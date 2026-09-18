// Infinite Voidsong — site footer
//
// A designed panel, not a credit line: wordmark + tagline + version on the
// left, site navigation in the middle, author credit on the right. Old-OS
// panel feel to match the rest of the chrome (see legal.css). `__APP_VERSION__`
// and `__BUILD_MONTH__` are injected at build time (see vite.config.ts).

declare const __APP_VERSION__: string;
declare const __BUILD_MONTH__: string;

function link(href: string, label: string, external = false): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = label;
  if (external) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  return a;
}

export function mountFooter(root: HTMLElement): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';

  const bar = document.createElement('div');
  bar.className = 'site-footer__bar';
  bar.textContent = 'FOOTER.SYS';
  bar.setAttribute('aria-hidden', 'true');

  const grid = document.createElement('div');
  grid.className = 'site-footer__grid';

  // Column 1: wordmark, tagline, version.
  const about = document.createElement('div');
  about.className = 'site-footer__col site-footer__about';

  const wordmark = document.createElement('p');
  wordmark.className = 'site-footer__wordmark';
  wordmark.textContent = 'INFINITE VOIDSONG';

  const tagline = document.createElement('p');
  tagline.className = 'site-footer__tagline';
  tagline.textContent = 'Endless generated soundscapes for focused work.';

  const version = document.createElement('p');
  version.className = 'site-footer__version';
  const appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
  const buildMonth = typeof __BUILD_MONTH__ === 'string' ? __BUILD_MONTH__ : '';
  version.textContent = `v${appVersion} · ${buildMonth}`;

  about.append(wordmark, tagline, version);

  // Column 2: navigation.
  const nav = document.createElement('div');
  nav.className = 'site-footer__col site-footer__nav';

  const navEyebrow = document.createElement('p');
  navEyebrow.className = 'site-footer__eyebrow';
  navEyebrow.textContent = 'Navigate';

  const navList = document.createElement('ul');
  navList.className = 'site-footer__links';
  const navItems: HTMLAnchorElement[] = [
    link('/guide.html', 'Guide'),
    link('/privacy.html', 'Privacy'),
    link('/shortcuts.html', 'Shortcuts'),
    link('https://sinaida.eu', 'sinaida.eu', true),
  ];
  navItems.forEach((a) => {
    const li = document.createElement('li');
    li.appendChild(a);
    navList.appendChild(li);
  });

  nav.append(navEyebrow, navList);

  // Column 3: author credit.
  const credit = document.createElement('div');
  credit.className = 'site-footer__col site-footer__credit';

  const madeBy = document.createElement('p');
  madeBy.className = 'site-footer__made-by';
  madeBy.append('Made by ', link('https://sinaida.eu', 'Sinaida Krivchenko', true));

  const place = document.createElement('p');
  place.className = 'site-footer__place';
  place.textContent = 'Prague';

  const local = document.createElement('p');
  local.className = 'site-footer__local';
  local.textContent = 'All sound is generated in your browser. Nothing leaves your device.';

  credit.append(madeBy, place, local);

  grid.append(about, nav, credit);
  footer.append(bar, grid);
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
