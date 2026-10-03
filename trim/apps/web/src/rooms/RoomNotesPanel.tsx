import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { cycleObservationSchema, type NoteCategory } from '@trim/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, apiSend } from '../api/client';
import { formatCalendarDate } from '../crops/format';
import { workbench } from '../theme';
import { NOTE_CATEGORIES, noteCategoryLabel } from './note-categories';

type Note = { id: string; occurredOn: string; authorName: string; category: string | null; body: string };

export function RoomNotesPanel({
  roomId,
  cycleName,
  notes,
}: {
  roomId: string;
  cycleName: string | null;
  notes: Note[];
}) {
  if (!cycleName) {
    return <Alert severity="info">This room has no active crop cycle.</Alert>;
  }

  const listed = [...notes].reverse();
  return (
    <Card sx={{ bgcolor: workbench.mist }} data-testid="room-notes">
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 20, mb: 1 }}>
          Notes
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
          Leave a note on {cycleName} for later. Choose a category, such as Environment or Pests.
        </Typography>
        <AddNoteForm roomId={roomId} />
        {listed.length === 0 ? (
          <Alert severity="info">No notes are recorded for this crop.</Alert>
        ) : (
          listed.map((note) => {
            const category = noteCategoryLabel(note.category);
            return (
            <Box key={note.id} data-testid="room-note" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontWeight: 600 }}>
                {formatCalendarDate(note.occurredOn)} · {note.authorName}
                {category ? ` · ${category}` : ''}
              </Typography>
              <Typography data-testid="room-note-body" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                {note.body}
              </Typography>
            </Box>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function AddNoteForm({ roomId }: { roomId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<NoteCategory>('general');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => apiSend(`/rooms/${roomId}/notes`, cycleObservationSchema, { category, body }),
    onSuccess: async () => {
      setError(null);
      setBody('');
      setCategory('general');
      setMessage('Note added.');
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    },
    onError: (caught) => {
      setMessage(null);
      setError(caught instanceof ApiError ? caught.message : 'The note could not be saved.');
    },
  });
  return (
    <Box sx={{ mb: 2 }}>
      {open ? (
        <Box
          component="form"
          sx={{ display: 'grid', gap: 1.5, maxWidth: 480, mb: 2 }}
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Typography variant="h3" sx={{ fontSize: 22 }}>
            Add note
          </Typography>
          <TextField
            select
            label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value as NoteCategory)}
            SelectProps={{ native: true, inputProps: { 'data-testid': 'note-category' } }}
          >
            {NOTE_CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </TextField>
          <TextField
            label="Note"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            multiline
            minRows={3}
            inputProps={{ 'data-testid': 'note-body' }}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button type="submit" variant="contained" data-testid="note-save" disabled={save.isPending}>
              Add note
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </Box>
        </Box>
      ) : (
        <Button variant="contained" data-testid="add-note" onClick={() => { setMessage(null); setOpen(true); }}>
          Add note
        </Button>
      )}
      {message ? <Alert sx={{ mt: 2 }} data-testid="note-added">{message}</Alert> : null}
    </Box>
  );
}
