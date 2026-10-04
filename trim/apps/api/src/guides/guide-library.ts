import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type GuideSection = { source: string; title: string; text: string };

let cached: GuideSection[] | null = null;

function loadGuides(): GuideSection[] {
  if (cached) {
    return cached;
  }
  const root = join(__dirname, '../../../../packages/guides');
  cached = [
    ...sections('User manual', readFileSync(join(root, 'user-manual.md'), 'utf8')),
    ...sections('Operating procedures', readFileSync(join(root, 'sop.md'), 'utf8')),
  ];
  return cached;
}

function sections(source: string, markdown: string): GuideSection[] {
  const chunks = markdown.replace(/\r\n/g, '\n').split(/\n## /);
  return chunks.slice(1).map((chunk) => {
    const [titleLine, ...rest] = chunk.split('\n');
    const title = (titleLine ?? '').trim();
    const text = rest.join('\n').trim();
    return { source, title, text };
  });
}

function terms(question: string): string[] {
  return [...new Set(question.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2))];
}

/** Sections from the user manual and operating procedures that match the question. */
export function guideExcerpts(question: string, limit = 4): string {
  const words = terms(question);
  const ranked = loadGuides()
    .map((section) => {
      const haystack = `${section.title} ${section.text}`.toLowerCase();
      const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
      return { section, score };
    })
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
  if (ranked.length === 0) {
    return '';
  }
  return ranked
    .map((row) => `${row.section.source} — ${row.section.title}\n${row.section.text.slice(0, 900)}`)
    .join('\n\n');
}

/** A short reply Serenity can give from the guides when no model reply is available. */
export function guideReply(question: string): string | null {
  const excerpt = guideExcerpts(question, 1);
  if (!excerpt) {
    return null;
  }
  return `From the guides:\n${excerpt}`;
}
