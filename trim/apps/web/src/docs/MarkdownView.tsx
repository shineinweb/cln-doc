import { Alert, Box, Card, CardContent, TextField, Typography } from '@mui/material';
import { useMemo, useState, type ReactNode } from 'react';
import { NavGlyph, type GlyphName } from '../components/Graphics';
import { workbench } from '../theme';

type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'table'; headers: string[]; rows: string[][] };

type Section = { title: string; blocks: Block[]; text: string };

function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      index += 1;
      continue;
    }

    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? '').startsWith('|')) {
        const cells = (lines[index] ?? '')
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-+:?$/.test(cell))) {
          rows.push(cells);
        }
        index += 1;
      }
      const [headers, ...body] = rows;
      if (headers) {
        blocks.push({ kind: 'table', headers, rows: body });
      }
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (index < lines.length && (lines[index] ?? '').startsWith('- ')) {
        items.push((lines[index] ?? '').slice(2));
        index += 1;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^\d+\. /, ''));
        index += 1;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index] ?? '';
      if (
        next.trim() === '' ||
        next.startsWith('#') ||
        next.startsWith('|') ||
        next.startsWith('- ') ||
        /^\d+\. /.test(next)
      ) {
        break;
      }
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

function blockText(block: Block): string {
  if (block.kind === 'heading') return block.text;
  if (block.kind === 'paragraph') return block.text;
  if (block.kind === 'ul' || block.kind === 'ol') return block.items.join(' ');
  return [...block.headers, ...block.rows.flat()].join(' ');
}

function splitSections(blocks: Block[]): { intro: Block[]; sections: Section[] } {
  const intro: Block[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const block of blocks) {
    if (block.kind === 'heading' && block.level === 1) {
      intro.push(block);
      continue;
    }
    if (block.kind === 'heading' && block.level === 2) {
      current = { title: block.text, blocks: [], text: block.text };
      sections.push(current);
      continue;
    }
    if (!current) {
      intro.push(block);
      continue;
    }
    current.blocks.push(block);
    current.text = `${current.text} ${blockText(block)}`;
  }
  return { intro, sections };
}

function sectionGlyph(title: string): GlyphName {
  const name = title.toLowerCase();
  if (name.includes('dashboard')) return 'dashboard';
  if (name.includes('facilit') || name.includes('site')) return 'facility';
  if (name.includes('room') || name.includes('calendar') || name.includes('reading')) return 'rooms';
  if (name.includes('cycle') || name.includes('template') || name.includes('reschedule')) return 'cycles';
  if (name.includes('task') || name.includes('assignment')) return 'workspace';
  if (name.includes('time') || name.includes('clock')) return 'timeclock';
  if (name.includes('compliance') || name.includes('license') || name.includes('submission')) return 'compliance';
  if (name.includes('harvest') || name.includes('package')) return 'harvests';
  if (name.includes('operation') || name.includes('irrigation') || name.includes('ipm') || name.includes('recurring')) return 'operations';
  if (name.includes('report') || name.includes('yield') || name.includes('cost')) return 'reports';
  if (name.includes('serenity')) return 'coach';
  if (name.includes('message')) return 'messages';
  if (name.includes('user') || name.includes('who can')) return 'access';
  if (name.includes('setting') || name.includes('gateway')) return 'settings';
  if (name.includes('sop') || name.includes('procedure')) return 'sop';
  return 'manual';
}

function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) {
      parts.push(text.slice(last, start));
    }
    if (token.startsWith('**')) {
      parts.push(
        <Box component="strong" key={key} sx={{ fontWeight: 700 }}>
          {token.slice(2, -2)}
        </Box>,
      );
    } else {
      parts.push(
        <Box
          component="code"
          key={key}
          sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.92em' }}
        >
          {token.slice(1, -1)}
        </Box>,
      );
    }
    key += 1;
    last = start + token.length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return <>{parts}</>;
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <Typography key={index} variant="h3" component="h3" sx={{ fontSize: 20, mt: 2, mb: 1 }}>
              <Inline text={block.text} />
            </Typography>
          );
        }
        if (block.kind === 'paragraph') {
          return (
            <Typography key={index} sx={{ mb: 1.25, fontSize: 16, lineHeight: 1.6 }}>
              <Inline text={block.text} />
            </Typography>
          );
        }
        if (block.kind === 'ul' || block.kind === 'ol') {
          const ListTag = block.kind === 'ul' ? 'ul' : 'ol';
          return (
            <Box key={index} component={ListTag} sx={{ mt: 0, mb: 1.5, pl: 3 }}>
              {block.items.map((item) => (
                <Typography key={item} component="li" sx={{ mb: 0.6, fontSize: 16, lineHeight: 1.5 }}>
                  <Inline text={item} />
                </Typography>
              ))}
            </Box>
          );
        }
        return (
          <Box key={index} sx={{ overflowX: 'auto', mb: 1.5 }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <Box component="thead">
                <Box component="tr">
                  {block.headers.map((header) => (
                    <Box component="th" key={header} sx={{ textAlign: 'left', p: 1, borderBottom: `1px solid ${workbench.line}` }}>
                      <Inline text={header} />
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {block.rows.map((row) => (
                  <Box component="tr" key={row.join('|')}>
                    {row.map((cell, cellIndex) => (
                      <Box component="td" key={`${cell}-${cellIndex}`} sx={{ p: 1, borderBottom: `1px solid ${workbench.line}`, verticalAlign: 'top' }}>
                        <Inline text={cell} />
                      </Box>
                    ))}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        );
      })}
    </>
  );
}

export function MarkdownView({
  source,
  testId,
  searchLabel,
}: {
  source: string;
  testId: string;
  searchLabel: string;
}) {
  const [query, setQuery] = useState('');
  const { intro, sections } = useMemo(() => splitSections(parseMarkdown(source)), [source]);
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? sections.filter((section) => section.text.toLowerCase().includes(needle) || section.title.toLowerCase().includes(needle))
    : sections;
  const title = intro.find((block) => block.kind === 'heading');
  const lead = intro.filter((block) => block.kind !== 'heading');

  return (
    <Box data-testid={testId} sx={{ maxWidth: 860 }}>
      {title && title.kind === 'heading' ? (
        <Typography variant="h1" component="h1" sx={{ fontSize: { xs: 34, md: 44 }, lineHeight: 1.1, mb: 1.5 }}>
          <Inline text={title.text} />
        </Typography>
      ) : null}
      <TextField
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchLabel}
        fullWidth
        inputProps={{ 'data-testid': `${testId}-search` }}
        sx={{ mb: 1.5 }}
      />
      <Typography sx={{ color: 'text.secondary', mb: 2, fontSize: 14 }} data-testid={`${testId}-search-count`}>
        {needle ? `${visible.length} matching section${visible.length === 1 ? '' : 's'}` : `${sections.length} sections. Search to narrow the page.`}
      </Typography>
      {!needle ? <Blocks blocks={lead} /> : null}
      {visible.length === 0 ? <Alert severity="info">Nothing in this guide matches that search.</Alert> : null}
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        {visible.map((section) => (
          <Card key={section.title} data-testid="guide-section" sx={{ bgcolor: workbench.paper }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    color: workbench.sky,
                    bgcolor: 'rgba(61, 220, 255, 0.12)',
                    flexShrink: 0,
                  }}
                >
                  <NavGlyph name={sectionGlyph(section.title)} />
                </Box>
                <Typography component="h2" variant="h2" sx={{ fontSize: { xs: 22, md: 26 }, m: 0 }}>
                  {section.title}
                </Typography>
              </Box>
              <Blocks blocks={section.blocks} />
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
