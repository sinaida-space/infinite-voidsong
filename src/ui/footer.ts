// Infinite Voidsong — site footer
//
// Three columns with one type scale: bright headings (product, Navigate,
// More) over quieter body text and links. `__APP_VERSION__` and
// `__BUILD_MONTH__` are injected at build time (see vite.config.ts).

import './scroll'; // every page opens at the top
import './brand'; // the product name is always red capitals

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

export interface FooterOptions {
  /** On the app page: open the welcome in place so playback is not interrupted. */
  onWelcome?: () => void;
  /** Where "go home" should scroll to when you are already home (default: the top of the page). */
  onHome?: () => void;
}

const isHome = (): boolean => location.pathname === '/' || location.pathname === '/index.html';

function scrollTopSmooth(): void {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}

function heading(text: string): HTMLParagraphElement {
  const h = document.createElement('p');
  h.className = 'site-footer__heading';
  h.textContent = text;
  return h;
}

function linkList(items: HTMLAnchorElement[]): HTMLUListElement {
  const ul = document.createElement('ul');
  ul.className = 'site-footer__links';
  items.forEach((a) => {
    const li = document.createElement('li');
    li.appendChild(a);
    ul.appendChild(li);
  });
  return ul;
}

export function mountFooter(root: HTMLElement, options: FooterOptions = {}): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';

  const grid = document.createElement('div');
  grid.className = 'site-footer__grid';

  // Column 1: the product.
  const about = document.createElement('div');
  about.className = 'site-footer__col';

  const tagline = document.createElement('p');
  tagline.textContent = 'Endless generated soundscapes for focused work.';

  const credit = document.createElement('p');
  credit.append('Created by ', link('https://sinaida.eu', 'Sinaida Krivchenko', true));

  const version = document.createElement('p');
  version.className = 'site-footer__version';
  const appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
  const buildMonth = typeof __BUILD_MONTH__ === 'string' ? __BUILD_MONTH__ : '';
  version.textContent = `v${appVersion} · ${buildMonth}`;

  // The product name is the home link: from the app it scrolls to the top, from any other page it goes home.
  const brand = heading('Infinite Voidsong');
  brand.textContent = '';
  const brandLink = link('/', 'Infinite Voidsong');
  brandLink.className = 'site-footer__brand';
  brandLink.addEventListener('click', (e) => {
    if (!isHome()) return; // normal navigation
    e.preventDefault();
    (options.onHome ?? scrollTopSmooth)();
  });
  brand.appendChild(brandLink);
  about.append(brand, tagline, credit, version);

  // Column 2: navigate. Other pages reach the welcome through `/?welcome=1`;
  // the app page opens it in place.
  const welcomeLink = link('/?welcome=1', 'Welcome screen');
  if (options.onWelcome) {
    const open = options.onWelcome;
    welcomeLink.addEventListener('click', (e) => {
      e.preventDefault();
      open();
    });
  }
  const nav = document.createElement('div');
  nav.className = 'site-footer__col';
  nav.append(
    heading('Navigate'),
    linkList([link('/guide.html', 'Guide'), welcomeLink, link('/shortcuts.html', 'Shortcuts')]),
  );

  // Column 3: more.
  const more = document.createElement('div');
  more.className = 'site-footer__col';
  more.append(
    heading('More'),
    linkList([
      link('/privacy.html', 'Privacy policy'),
      link('/terms.html', 'Terms and conditions'),
      link('/research.html', 'Research and sources'),
    ]),
  );

  grid.append(about, nav, more);
  footer.append(grid);
  root.appendChild(footer);
  return footer;
}

// Legal pages (privacy, terms, shortcuts, 404) mount the footer standalone here;
// the main app mounts it itself in main.ts.
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
