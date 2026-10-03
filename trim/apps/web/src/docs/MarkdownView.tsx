import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'table'; headers: string[]; rows: string[][] };

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
        <Box component="strong" key={key} sx={{ fontWeight: 650 }}>
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

export function MarkdownView({ source, testId }: { source: string; testId: string }) {
  const blocks = parseMarkdown(source);
  return (
    <Box data-testid={testId} sx={{ maxWidth: 820 }}>
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          const variant = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
          const fontSize = block.level === 1 ? { xs: 34, md: 44 } : block.level === 2 ? 28 : 22;
          return (
            <Typography
              key={index}
              variant={variant}
              component={variant}
              sx={{ fontSize, lineHeight: 1.15, mt: block.level === 1 ? 0 : 4, mb: 1.5 }}
            >
              <Inline text={block.text} />
            </Typography>
          );
        }
        if (block.kind === 'paragraph') {
          return (
            <Typography key={index} sx={{ mb: 1.5, fontSize: 17, lineHeight: 1.55 }}>
              <Inline text={block.text} />
            </Typography>
          );
        }
        if (block.kind === 'ul' || block.kind === 'ol') {
          const ListTag = block.kind === 'ul' ? 'ul' : 'ol';
          return (
            <Box key={index} component={ListTag} sx={{ mt: 0, mb: 2, pl: 3 }}>
              {block.items.map((item) => (
                <Typography key={item} component="li" sx={{ mb: 0.75, fontSize: 17, lineHeight: 1.5 }}>
                  <Inline text={item} />
                </Typography>
              ))}
            </Box>
          );
        }
        return (
          <Box key={index} sx={{ overflowX: 'auto', mb: 2 }}>
            <Table size="small" sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow>
                  {block.headers.map((header) => (
                    <TableCell key={header} sx={{ fontWeight: 700 }}>
                      <Inline text={header} />
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {block.rows.map((row) => (
                  <TableRow key={row.join('|')}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={`${cell}-${cellIndex}`}>
                        <Inline text={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        );
      })}
    </Box>
  );
}
