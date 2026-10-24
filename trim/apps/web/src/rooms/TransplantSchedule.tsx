import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { transplantSchema, type RoomDetail } from '@trim/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { apiSend } from '../api/client';
import { addCalendarDays, formatCalendarDate, inclusiveDayCount } from '../crops/format';

type Row = { key: string; date: string };

export function TransplantSchedule({ room }: { room: RoomDetail }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(room));
  const [message, setMessage] = useState<string | null>(null);
  const hasCrop = Boolean(room.currentCycle);
  const startDate = room.currentCycle?.startDate ?? null;
  const savedKey = room.transplants.map((item) => `${item.id}:${item.dayNumber}`).join(',');

  useEffect(() => {
    setRows(rowsFrom(room));
  }, [savedKey, room]);

  const save = useMutation({
    mutationFn: (days: number[]) => apiSend(`/rooms/${room.id}/transplants`, z.array(transplantSchema), { days }, 'PUT'),
    onSuccess: async () => {
      setMessage('Transplant dates saved.');
      await queryClient.invalidateQueries({ queryKey: ['room', room.id] });
      await queryClient.invalidateQueries({ queryKey: ['facility-board'] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <Card data-testid="transplant-schedule">
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
          Transplant dates
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
          {hasCrop && startDate
            ? `Pick calendar dates for ${room.currentCycle!.name}. Day 1 is ${formatCalendarDate(startDate)}. These dates fill the Facility board T column for this room.`
            : 'Start a crop on this room before picking transplant dates. The date picker needs the crop start as day 1. Stored days still fill Facility board T once a crop is running.'}
        </Typography>
        {!hasCrop ? (
          <Alert severity="info" sx={{ mb: 1.5 }} data-testid="transplant-needs-crop">
            A crop must be started before transplant dates can be picked.
            {room.transplants.length > 0
              ? ` ${room.transplants.length} day number${room.transplants.length === 1 ? '' : 's'} already stored; calendar dates appear after a crop starts.`
              : ''}
          </Alert>
        ) : null}
        {hasCrop && rows.length === 0 ? <Alert severity="info">No transplant dates are scheduled.</Alert> : null}
        <Box sx={{ display: 'grid', gap: 1.5, maxWidth: 520, mt: hasCrop && rows.length === 0 ? 1.5 : 0 }}>
          {hasCrop
            ? rows.map((row, index) => {
                const dayNumber = dayNumberFor(startDate, row.date);
                return (
                  <Box key={row.key} sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center' }}>
                    <TextField
                      label="Transplant date"
                      type="date"
                      value={row.date}
                      onChange={(event) =>
                        setRows((current) => current.map((item) => (item.key === row.key ? { ...item, date: event.target.value } : item)))
                      }
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ min: startDate ?? undefined, 'data-testid': `transplant-date-${index}` }}
                      helperText={
                        dayNumber != null
                          ? `Day ${dayNumber} · ${formatCalendarDate(row.date)}`
                          : startDate
                            ? `Counted from ${formatCalendarDate(startDate)} (day 1).`
                            : 'Pick a date on or after crop start.'
                      }
                    />
                    <Button
                      data-testid={`transplant-remove-${index}`}
                      onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                    >
                      Remove
                    </Button>
                  </Box>
                );
              })
            : null}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button
            data-testid="transplant-add"
            disabled={!hasCrop}
            onClick={() =>
              setRows((current) => [
                ...current,
                { key: `new-${Date.now()}-${current.length}`, date: startDate ?? '' },
              ])
            }
          >
            Add transplant
          </Button>
          <Button
            variant="contained"
            data-testid="transplant-save"
            disabled={save.isPending || !hasCrop}
            onClick={() => {
              if (!startDate) {
                setMessage('Start a crop before saving transplant dates.');
                return;
              }
              const days: number[] = [];
              for (const row of rows) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
                  setMessage('Pick a transplant date for each row.');
                  return;
                }
                const dayNumber = dayNumberFor(startDate, row.date);
                if (dayNumber == null || dayNumber < 1) {
                  setMessage(`Each transplant date must be on or after ${formatCalendarDate(startDate)}.`);
                  return;
                }
                days.push(dayNumber);
              }
              if (new Set(days).size !== days.length) {
                setMessage('Each transplant date can be listed once.');
                return;
              }
              setMessage(null);
              save.mutate(days);
            }}
          >
            Save schedule
          </Button>
        </Box>
        {message ? <Alert sx={{ mt: 2 }} severity={message === 'Transplant dates saved.' ? 'success' : 'error'}>{message}</Alert> : null}
      </CardContent>
    </Card>
  );
}

function rowsFrom(room: RoomDetail): Row[] {
  const startDate = room.currentCycle?.startDate;
  if (!startDate) {
    return [];
  }
  return room.transplants.map((item) => ({
    key: item.id,
    date: item.date ?? addCalendarDays(startDate, item.dayNumber - 1),
  }));
}

function dayNumberFor(startDate: string | null, date: string): number | null {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  const dayNumber = inclusiveDayCount(startDate, date);
  if (!Number.isInteger(dayNumber) || dayNumber < 1) {
    return null;
  }
  return dayNumber;
}
