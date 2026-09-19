// Runs after `vite build`. Writes the files that are made from the built site:
//
//   dist/<page>.md                                   a Markdown version of each page, for
//                                                    agents that ask for `Accept: text/markdown`
//   dist/.well-known/agent-skills/index.json         the skills index, with a sha256 of each skill file
//
// Run:  tsx scripts/build-agent-files.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUIDE_SECTIONS } from '../src/content/guide';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const SITE = 'https://infinite-voidsong.vercel.app'; // keep in step with SITE_URL in vite.config.ts

const decode = (s: string): string =>
  s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/ /g, ' ');

/** A small HTML to Markdown pass for the plain pages (headings, paragraphs, lists, links, code). */
function htmlToMarkdown(html: string): string {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  let s = main
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) => {
      const abs = href.startsWith('/') ? `${SITE}${href}` : href;
      return `[${text.replace(/<[^>]+>/g, '').trim()}](${abs})`;
    })
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  s = decode(s)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return `${s}\n`;
}

function guideMarkdown(): string {
  const out: string[] = ['# Guide', '', `Source: ${SITE}/guide.html`, ''];
  for (const sec of GUIDE_SECTIONS) {
    out.push(`## ${sec.title}`, '');
    for (const p of sec.body) out.push(p, '');
    if (sec.table) {
      out.push(`| ${sec.table.head.join(' | ')} |`, `| ${sec.table.head.map(() => '---').join(' | ')} |`);
      for (const row of sec.table.rows) out.push(`| ${row.join(' | ')} |`);
      out.push('');
    }
  }
  return `${out.join('\n').trim()}\n`;
}

const write = (rel: string, body: string): void => {
  const file = resolve(DIST, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  console.log(`agent files: wrote ${rel}`);
};

// --- Markdown pages -----------------------------------------------------------------
write('index.md', readFileSync(resolve(ROOT, 'public/llms.txt'), 'utf8'));
write('guide.md', guideMarkdown());
for (const page of ['privacy', 'terms', 'research', 'shortcuts']) {
  const htmlPath = resolve(DIST, `${page}.html`);
  if (existsSync(htmlPath)) write(`${page}.md`, htmlToMarkdown(readFileSync(htmlPath, 'utf8')));
}

// --- skills index ---------------------------------------------------------------------
const skillPath = '.well-known/agent-skills/infinite-voidsong/SKILL.md';
const skill = readFileSync(resolve(DIST, skillPath));
const digest = `sha256:${createHash('sha256').update(skill).digest('hex')}`;
write('.well-known/agent-skills/index.json', `${JSON.stringify({
  $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  skills: [
    {
      name: 'infinite-voidsong',
      type: 'skill-md',
      description: 'Pick a sound mode and a timed session length for the task a person is doing with Infinite Voidsong, a browser tool for generated focus soundscapes, then start it.',
      url: `${SITE}/${skillPath}`,
      digest,
    },
  ],
}, null, 2)}\n`);
