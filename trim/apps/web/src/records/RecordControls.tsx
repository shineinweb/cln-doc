import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TableCell,
  TableContainer,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type ReactNode } from 'react';
import { workbench } from '../theme';

export const PAGE_SIZE = 5;

export type SortDirection = 'asc' | 'desc';

export type ListQueryState<Key extends string> = {
  query: string;
  sortKey: Key;
  sortDirection: SortDirection;
  setQuery: (value: string) => void;
  toggleSort: (key: Key) => void;
};

export function useListQuery<Key extends string>(defaultSortKey: Key, defaultDirection: SortDirection = 'asc'): ListQueryState<Key> {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<Key>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);
  return {
    query,
    sortKey,
    sortDirection,
    setQuery,
    toggleSort: (key) => {
      if (key === sortKey) {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
        return;
      }
      setSortKey(key);
      setSortDirection('asc');
    },
  };
}

export function filterAndSortRows<T, Key extends string>(
  rows: T[],
  list: ListQueryState<Key>,
  matches: (row: T, query: string) => boolean,
  valueFor: (row: T, key: Key) => string | number,
): T[] {
  const needle = list.query.trim().toLowerCase();
  const filtered = needle ? rows.filter((row) => matches(row, needle)) : [...rows];
  filtered.sort((left, right) => {
    const leftValue = valueFor(left, list.sortKey);
    const rightValue = valueFor(right, list.sortKey);
    const compared =
      typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: 'base', numeric: true });
    return list.sortDirection === 'asc' ? compared : -compared;
  });
  return filtered;
}

export function ListSearch({
  value,
  onChange,
  placeholder,
  testId = 'list-search',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  testId?: string;
}) {
  return (
    <TextField
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputProps={{ 'data-testid': testId, 'aria-label': placeholder }}
      sx={{ minWidth: { xs: '100%', sm: 260 }, maxWidth: 360 }}
    />
  );
}

export function SortableHeader({
  label,
  active,
  direction,
  onClick,
  align = 'left',
  testId,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: 'left' | 'right';
  testId?: string;
}) {
  return (
    <TableCell align={align} sortDirection={active ? direction : false}>
      <TableSortLabel active={active} direction={direction} onClick={onClick} data-testid={testId} sx={{ fontWeight: 700 }}>
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

export function SectionToolbar({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        mb: 1.5,
      }}
    >
      <Typography variant="h2" sx={{ fontSize: 26, m: 0 }}>
        {title}
      </Typography>
      {action ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{action}</Box> : null}
    </Box>
  );
}

export function TablePanel({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <Card
      data-testid={testId}
      sx={{
        overflow: 'hidden',
        mb: 0,
        backgroundImage: 'none',
        bgcolor: workbench.paper,
      }}
    >
      <TableContainer sx={{ overflowX: 'auto', maxWidth: '100%', overscrollBehaviorX: 'contain' }}>{children}</TableContainer>
    </Card>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.5,
        justifyContent: 'flex-end',
        flexWrap: 'nowrap',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Box>
  );
}

export function PagedList<T>({
  items,
  empty,
  testId,
  render,
}: {
  items: T[];
  empty: string;
  testId?: string;
  render: (item: T) => ReactNode;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return (
    <Box data-testid={testId} sx={{ display: 'grid', gap: 1, mb: 2 }}>
      {items.length === 0 ? <Alert severity="info">{empty}</Alert> : null}
      {items.length > 0 ? (
        <Card sx={{ backgroundImage: 'none', bgcolor: workbench.paper, overflow: 'hidden' }}>
          <Box sx={{ display: 'grid' }}>{slice.map(render)}</Box>
        </Card>
      ) : null}
      <Pager page={safePage} pageCount={pageCount} total={items.length} onPage={setPage} />
    </Box>
  );
}

export function Pager({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total <= 0) {
    return null;
  }
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'center',
        flexWrap: 'wrap',
        mt: 1.5,
        px: 0.5,
      }}
    >
      <Button
        size="small"
        variant="outlined"
        data-testid="page-previous"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </Button>
      <Typography data-testid="page-status" sx={{ color: 'text.secondary', fontSize: 14, flex: 1, textAlign: 'center' }}>
        Page {page} of {pageCount} · {total} {total === 1 ? 'row' : 'rows'}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        data-testid="page-next"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Button>
    </Box>
  );
}

export function RecordActions({
  summary,
  detail,
  editor,
  onDelete,
  keepsHistory = false,
  allowEdit = true,
  allowDelete = true,
  extraActions,
}: {
  summary: ReactNode;
  detail: ReactNode;
  editor: ReactNode;
  onDelete: () => void;
  keepsHistory?: boolean;
  /** When false, Edit is hidden (read-only roles). */
  allowEdit?: boolean;
  /** When false, Delete is hidden (read-only roles). */
  allowDelete?: boolean;
  /** Optional controls rendered before View/Edit/Delete (e.g. Finished). */
  extraActions?: ReactNode;
}) {
  const [mode, setMode] = useState<'closed' | 'view' | 'edit'>('closed');
  const editOpen = allowEdit && mode === 'edit';
  return (
    <Box sx={{ py: 1.25, px: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 180 }}>{summary}</Box>
        <RowActions>
          {extraActions}
          <Button size="small" data-testid="view-record" onClick={() => setMode(mode === 'view' ? 'closed' : 'view')}>
            View
          </Button>
          {allowEdit ? (
            <Button size="small" data-testid="edit-record" onClick={() => setMode(mode === 'edit' ? 'closed' : 'edit')}>
              Edit
            </Button>
          ) : null}
          {allowDelete ? <DeleteRecord keepsHistory={keepsHistory} onConfirm={onDelete} /> : null}
        </RowActions>
      </Box>
      {mode === 'view' ? <Box sx={{ mt: 1 }}>{detail}</Box> : null}
      {editOpen ? <Box sx={{ mt: 1 }}>{editor}</Box> : null}
    </Box>
  );
}

export function DeleteRecord({ keepsHistory, onConfirm }: { keepsHistory: boolean; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="small" color="secondary" data-testid="delete-record" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Delete this record?</DialogTitle>
        <DialogContent>
          <Typography>
            {keepsHistory
              ? 'This leaves the active list. The row and its actor stay in history.'
              : 'This removes the row.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            data-testid="confirm-delete"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function TextEdit({
  label,
  name,
  defaultValue,
  pending,
  onSave,
  inputType = 'text',
}: {
  label: string;
  name: string;
  defaultValue: string;
  pending?: boolean;
  onSave: (value: string) => void;
  inputType?: string;
}) {
  return (
    <Box
      component="form"
      sx={{ display: 'grid', gap: 1, maxWidth: 420 }}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(String(new FormData(event.currentTarget).get(name) ?? ''));
      }}
    >
      <TextField
        label={label}
        name={name}
        type={inputType}
        defaultValue={defaultValue}
        required
        InputLabelProps={inputType === 'date' ? { shrink: true } : undefined}
      />
      <SaveChanges pending={pending} />
    </Box>
  );
}

export function SaveChanges({ pending }: { pending?: boolean }) {
  return (
    <Button type="submit" variant="contained" data-testid="save-changes" disabled={pending} sx={{ mt: 1, justifySelf: 'start' }}>
      Save changes
    </Button>
  );
}
