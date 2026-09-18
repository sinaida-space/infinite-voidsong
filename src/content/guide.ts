// Infinite Voidsong — guide content (task 18)
//
// Single source of truth for the GUIDE.TXT copy, rendered by both guide.html
// (a standalone page) and src/ui/guide.ts (mountGuide, the in-app window).
// Evidence-honest by design: claims stay modest and hedged, never overstated,
// and no wording here reaches for medical language. Source: audio-reqs.md §5–§6.

export interface GuideTable {
  head: string[];
  rows: string[][];
}

export interface GuideSection {
  id: string;
  title: string;
  body: string[];
  table?: GuideTable;
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'sessions',
    title: 'Sessions',
    body: [
      'A timed session pairs a work block with a break, then repeats. Pick a length that matches how a task starts for you and how long your attention holds.',
      '25 minutes on, 5 minutes off is the Pomodoro rhythm. The block is short enough to start without much resistance, which suits admin work and days when motivation runs low.',
      '50 minutes on, 10 minutes off suits work with a real warm-up, such as writing or coding, where the first few minutes go to finding the thread. The block stays long enough to keep hold of that thread once it appears.',
      '90 minutes on, 15 minutes off follows one ultradian cycle: attention runs in waves of roughly that length. Reach for it once you already know how to start deep work and want an uninterrupted stretch.',
      'A break plays a quiet stream rather than silence, because attention recovers faster with a real pause than with more effort. Each session ends with a slow fade rather than a hard stop, so nothing startles you out of the work.',
    ],
  },
  {
    id: 'presets',
    title: 'Presets',
    body: [],
    table: {
      head: ['Task', 'Plays', 'Why', 'Avoid'],
      rows: [
        ['Deep focus', 'Pink noise, a café murmur, or ambient pads, with Focus Boost turned on by default.', 'Steady low-event sound masks distraction without asking for attention of its own.', 'Vocals, complex solos, sudden transitions.'],
        ['Reading & writing', 'Pink or brown noise, soft rain, or silence if the room is already quiet.', 'Any lyrics or intelligible speech compete for the same verbal system that reading and writing use.', 'Lyrics in any language, intelligible speech, or music that is both fast and loud.'],
        ['Creative flow', 'A ten-minute warm-up of upbeat instrumental music, then café ambience or nature at a lively level.', 'Ideation runs on moderate arousal, and dead silence leaves it flat.', 'Dead silence, volume past Café.'],
        ['Routine', 'Lofi or upbeat instrumental music, or fan-style noise.', 'Repetitive admin work benefits from arousal that a purely relaxing texture would flatten.', 'Textures relaxing enough to drift toward drowsiness.'],
        ['Break & restore', 'A quiet nature stream: water with sparse birdsong.', 'Recovery calls for restoration: quiet, low-event sound that lets attention settle.', 'Speech of any kind, including podcasts and news.'],
        ['Sleep', 'Pink noise, rain, or underwater, kept at Whisper level with the sleep timer running.', 'A steady low layer masks disruption without adding enough arousal to keep you from sleep.', 'Any bright or alert-sounding scene.'],
      ],
    },
  },
  {
    id: 'sound-families',
    title: 'Sound families',
    body: [
      'Noise moves between white, pink, and brown, and masks the sound around you. Some people find it helps concentration, and some would rather work in quiet.',
      'Water, air, and fire are restoration scenes with few events: slow ripples, soft wind, sparse embers. They sit low in the mix and rarely draw the ear toward them.',
      'Places recreate the low murmur of a café: a wash of voices too quiet to make out as words. At a moderate level it suits idea work well, and it never turns into speech you could actually follow.',
      'Music covers drone, lofi, plucks, synthwave, berlin, house, and chillhop, all instrumental and steady, with no vocals and no sudden shifts. It helps most with routine work and ideation, and helps least when you are reading closely.',
      'Tone is a steady pitch you can tune by ear, closer to a pure sine at one end and to a soft noise band at the other. Some people find a single steady tone easier to hold focus against than a changing scene.',
    ],
  },
  {
    id: 'volume',
    title: 'How loud',
    body: [
      'An estimate, device-dependent: keep the device volume moderate whenever a session runs long.',
    ],
    table: {
      head: ['Band', 'Label', 'Suits'],
      rows: [
        ['30–40 dB', 'Whisper', 'Breaks, sleep wind-down.'],
        ['40–50 dB', 'Library', 'Reading and writing.'],
        ['50–60 dB', 'Workspace', 'General focus, masking in most rooms.'],
        ['60–70 dB', 'Café', 'Creative ideation.'],
        ['70–85 dB', 'Too loud for focus', 'A warning band: creativity and attention degrade here.'],
      ],
    },
  },
  {
    id: 'focus-boost',
    title: 'Focus Boost',
    body: [
      'Focus Boost adds a 12–20 Hz pulse to the music layer. It may help some people sustain attention, more so for people who find it hard to stay on task. Results are personal and vary by task, so switch it off whenever it feels like a distraction.',
    ],
  },
  {
    id: 'keyboard',
    title: 'Keyboard',
    body: [
      'Space plays and pauses. The arrow keys move master volume up and down, and step between layers left and right. M mutes the selected layer. Esc closes the open panel. The number keys 1 to 6 jump to a preset. The question mark key opens this guide.',
    ],
  },
];

// --- shared rendering ---------------------------------------------------------
//
// One render path for both consumers named above, so the markup (and its
// class contract) never drifts between the standalone page and the in-app
// window: `.guide`, `.guide__section`, `.guide__title`, `.guide__body`,
// `.guide__table`.

function renderTable(table: GuideTable): HTMLElement {
  const el = document.createElement('table');
  el.className = 'guide__table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const cell of table.head) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = cell;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  el.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of table.rows) {
    const tr = document.createElement('tr');
    for (const cell of row) {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  el.appendChild(tbody);

  const wrap = document.createElement('div');
  wrap.className = 'guide__table-wrap';
  wrap.appendChild(el);

  return wrap;
}

/** Builds one `.guide__section` element: title, then its table (if any), then its body paragraphs. */
export function renderGuideSection(section: GuideSection): HTMLElement {
  const el = document.createElement('section');
  el.className = 'guide__section';
  el.id = 'guide-' + section.id;

  const title = document.createElement('h2');
  title.className = 'guide__title';
  title.textContent = section.title;
  el.appendChild(title);

  if (section.table) {
    el.appendChild(renderTable(section.table));
  }

  for (const paragraph of section.body) {
    const p = document.createElement('p');
    p.className = 'guide__paragraph';
    p.textContent = paragraph;
    el.appendChild(p);
  }

  return el;
}

/** Renders every section into `container` in order, replacing its current content. */
export function renderGuideSections(container: HTMLElement): void {
  container.innerHTML = '';
  for (const section of GUIDE_SECTIONS) {
    container.appendChild(renderGuideSection(section));
  }
}
