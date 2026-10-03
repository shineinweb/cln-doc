import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';

export const PAGE_SIZE = 5;

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
      {items.length === 0 ? <Alert severity="info">{empty}</Alert> : slice.map(render)}
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
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
      <Button variant="outlined" data-testid="page-previous" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <Typography data-testid="page-status">
        Page {page} of {pageCount} · {total} {total === 1 ? 'row' : 'rows'}
      </Typography>
      <Button variant="outlined" data-testid="page-next" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
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
}: {
  summary: ReactNode;
  detail: ReactNode;
  editor: ReactNode;
  onDelete: () => void;
  keepsHistory?: boolean;
}) {
  const [mode, setMode] = useState<'closed' | 'view' | 'edit'>('closed');
  return (
    <Box sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 180 }}>{summary}</Box>
        <Button size="small" data-testid="view-record" onClick={() => setMode(mode === 'view' ? 'closed' : 'view')}>
          View
        </Button>
        <Button size="small" data-testid="edit-record" onClick={() => setMode(mode === 'edit' ? 'closed' : 'edit')}>
          Edit
        </Button>
        <DeleteRecord keepsHistory={keepsHistory} onConfirm={onDelete} />
      </Box>
      {mode === 'view' ? <Box sx={{ mt: 1 }}>{detail}</Box> : null}
      {mode === 'edit' ? <Box sx={{ mt: 1 }}>{editor}</Box> : null}
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
