// The product name is always red and always capitals, wherever it appears.
//
// Static pages and text built by scripts both write it as normal words
// ("Infinite Voidsong"). This wraps every occurrence in a `.brand` span, which
// chrome.css turns red and uppercase, and keeps watching so text added later
// (the guide window, the welcome, toasts) gets the same treatment.

const NAME = /infinite voidsong/gi;
const SKIP = 'script, style, title, noscript, textarea, code, pre, .brand, .glitch, [data-nobrand]';

function wrapIn(node: Text): void {
  const text = node.nodeValue ?? '';
  NAME.lastIndex = 0;
  if (!NAME.test(text)) return;
  NAME.lastIndex = 0;

  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of text.matchAll(NAME)) {
    const at = m.index ?? 0;
    if (at > last) frag.append(text.slice(last, at));
    const span = document.createElement('span');
    span.className = 'brand';
    span.textContent = m[0];
    frag.append(span);
    last = at + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  node.replaceWith(frag);
}

function brandify(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const parent = n.parentElement;
      if (!parent || parent.closest(SKIP)) return NodeFilter.FILTER_REJECT;
      return NAME.test(n.nodeValue ?? '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const found: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) found.push(n as Text);
  found.forEach(wrapIn);
}

export function startBranding(): void {
  if (typeof document === 'undefined') return;
  const run = (): void => {
    brandify(document.body);
    new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) brandify(n);
        else if (n.nodeType === Node.TEXT_NODE && n.parentElement && !n.parentElement.closest(SKIP)) wrapIn(n as Text);
      });
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
}

startBranding();
