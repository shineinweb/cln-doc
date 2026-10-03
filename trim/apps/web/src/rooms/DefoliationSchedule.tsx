import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { defoliationSchema, type RoomDetail } from '@trim/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { apiSend } from '../api/client';
import { addCalendarDays, formatCalendarDate } from '../crops/format';

type Row = { key: string; day: string };

export function DefoliationSchedule({ room }: { room: RoomDetail }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(room));
  const [message, setMessage] = useState<string | null>(null);
  const savedKey = room.defoliations.map((item) => `${item.id}:${item.dayNumber}`).join(',');

  useEffect(() => {
    setRows(rowsFrom(room));
  }, [savedKey, room]);

  const save = useMutation({
    mutationFn: (days: number[]) => apiSend(`/rooms/${room.id}/defoliations`, z.array(defoliationSchema), { days }, 'PUT'),
    onSuccess: async () => {
      setMessage('Defoliation schedule saved.');
      await queryClient.invalidateQueries({ queryKey: ['room', room.id] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <Card data-testid="defoliation-schedule">
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
          Defoliation schedule
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
          {room.currentCycle
            ? `Day 1 is ${formatCalendarDate(room.currentCycle.startDate)}, the start of ${room.currentCycle.name}. A day number of 10 is the tenth day of that crop.`
            : 'Day 1 is the crop start. This room has no active crop, so the dates stay blank until a crop starts.'}
        </Typography>
        {rows.length === 0 ? <Alert severity="info">No defoliations are scheduled.</Alert> : null}
        <Box sx={{ display: 'grid', gap: 1.5, maxWidth: 520, mt: rows.length === 0 ? 1.5 : 0 }}>
          {rows.map((row, index) => {
            const date = dateFor(room, row.day);
            return (
              <Box key={row.key} sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center' }}>
                <TextField
                  label="Defoliation day"
                  type="number"
                  value={row.day}
                  onChange={(event) => setRows((current) => current.map((item) => (item.key === row.key ? { ...item, day: event.target.value } : item)))}
                  inputProps={{ min: 1, 'data-testid': `defoliation-day-${index}` }}
                  helperText={date ? `Day ${Number(row.day)} is ${date}` : 'Counted from the cycle start. Day 1 is the start date.'}
                />
                <Button
                  data-testid={`defoliation-remove-${index}`}
                  onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                >
                  Remove
                </Button>
              </Box>
            );
          })}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button
            data-testid="defoliation-add"
            onClick={() => setRows((current) => [...current, { key: `new-${Date.now()}-${current.length}`, day: '' }])}
          >
            Add defoliation
          </Button>
          <Button
            variant="contained"
            data-testid="defoliation-save"
            disabled={save.isPending}
            onClick={() => {
              const days = rows.map((row) => Number(row.day));
              if (rows.some((row) => !/^\d+$/.test(row.day) || Number(row.day) < 1)) {
                setMessage('Enter a day number for each defoliation.');
                return;
              }
              if (new Set(days).size !== days.length) {
                setMessage('Each defoliation day can be listed once.');
                return;
              }
              setMessage(null);
              save.mutate(days);
            }}
          >
            Save schedule
          </Button>
        </Box>
        {message ? <Alert sx={{ mt: 2 }} severity={message === 'Defoliation schedule saved.' ? 'success' : 'error'}>{message}</Alert> : null}
      </CardContent>
    </Card>
  );
}

function rowsFrom(room: RoomDetail): Row[] {
  return room.defoliations.map((item) => ({ key: item.id, day: String(item.dayNumber) }));
}

function dateFor(room: RoomDetail, day: string): string | null {
  const dayNumber = Number(day);
  if (!room.currentCycle || !Number.isInteger(dayNumber) || dayNumber < 1) {
    return null;
  }
  return formatCalendarDate(addCalendarDays(room.currentCycle.startDate, dayNumber - 1));
}
