// Keyboard shortcuts that work on any layout, Russian included.
//
// A shortcut belongs to a physical key, not to the letter printed on it: with a
// Russian layout the H key types "р" and F types "а", yet both still count as H
// and F. `event.code` names the physical key, so it is read first. If a
// browser or a virtual keyboard gives no code, the typed character is used,
// with the Russian letters mapped back to the Latin ones.

const RU_TO_LATIN: Record<string, string> = {
  й: 'q', ц: 'w', у: 'e', к: 'r', е: 't', н: 'y', г: 'u', ш: 'i', щ: 'o', з: 'p',
  ф: 'a', ы: 's', в: 'd', а: 'f', п: 'g', р: 'h', о: 'j', л: 'k', д: 'l',
  я: 'z', ч: 'x', с: 'c', м: 'v', и: 'b', т: 'n', ь: 'm',
};

/**
 * A layout-independent name for the key: a lower-case letter ('h', 'f', 'm', 'w'…),
 * a digit ('1'), ' ' for Space, '?' for a question mark, or the key's own name
 * ('ArrowUp', 'Escape', 'Enter', 'Tab').
 */
export function shortcutKey(e: KeyboardEvent): string {
  if (e.key === '?') return '?'; // on a Russian layout this is Shift+7, on a US one Shift+/
  const c = e.code || '';
  if (/^Key[A-Z]$/.test(c)) return c.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(c)) return c.slice(5);
  if (/^Numpad[0-9]$/.test(c)) return c.slice(6);
  if (c === 'Space') return ' ';
  if (c === 'Slash' && e.shiftKey) return '?';
  const k = e.key;
  if (k === 'Spacebar') return ' ';
  if (k.length === 1) {
    const lower = k.toLowerCase();
    return RU_TO_LATIN[lower] ?? lower;
  }
  return k;
}

/** True when a browser or system shortcut is meant (Ctrl, Cmd or Alt held): ours must stay out of the way. */
export const hasCommandModifier = (e: KeyboardEvent): boolean => e.ctrlKey || e.metaKey || e.altKey;
