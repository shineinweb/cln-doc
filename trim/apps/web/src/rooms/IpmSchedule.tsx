import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Typography,
} from '@mui/material';
import { ipmScheduleSchema, type RoomDetail, type Weekday } from '@trim/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InputHTMLAttributes } from 'react';
import { useEffect, useState } from 'react';
import { apiSend } from '../api/client';

const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

const DEFAULT_TWICE_WEEKLY: Weekday[] = ['tue', 'fri'];

export function IpmSchedule({ room }: { room: RoomDetail }) {
  const queryClient = useQueryClient();
  const savedKey = room.ipmSchedule.weekdays.join(',');
  const [weekdays, setWeekdays] = useState<Weekday[]>(() =>
    room.ipmSchedule.weekdays.length > 0 ? room.ipmSchedule.weekdays : DEFAULT_TWICE_WEEKLY,
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setWeekdays(room.ipmSchedule.weekdays.length > 0 ? room.ipmSchedule.weekdays : DEFAULT_TWICE_WEEKLY);
  }, [savedKey, room.ipmSchedule.weekdays]);

  const save = useMutation({
    mutationFn: (days: Weekday[]) =>
      apiSend(`/rooms/${room.id}/ipm-schedule`, ipmScheduleSchema, { weekdays: days }, 'PUT'),
    onSuccess: async () => {
      setMessage('IPM schedule saved.');
      await queryClient.invalidateQueries({ queryKey: ['room', room.id] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const selected = WEEKDAYS.filter((day) => weekdays.includes(day.key)).map((day) => day.key);
  const summary =
    selected.length === 2
      ? `${labelFor(selected[0]!)} and ${labelFor(selected[1]!)}`
      : selected.length === 0
        ? 'No days selected'
        : `${selected.length} day${selected.length === 1 ? '' : 's'} selected — choose exactly two`;

  return (
    <Card data-testid="ipm-schedule">
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 22, mb: 1 }}>
          IPM schedule
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
          Twice-a-week scout cadence for this room. Pick exactly two days. Clear both and save to turn the schedule off.
          Log findings under Operations → IPM.
        </Typography>
        {room.ipmSchedule.weekdays.length === 0 ? (
          <Alert severity="info" sx={{ mb: 1.5 }} data-testid="ipm-schedule-empty">
            No IPM schedule is saved yet. Tuesday and Friday are suggested.
          </Alert>
        ) : null}
        <Typography sx={{ fontSize: 14, mb: 0.5 }}>Scout days</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1 }} data-testid="ipm-schedule-days">
          {WEEKDAYS.map((day) => (
            <FormControlLabel
              key={day.key}
              control={
                <Checkbox
                  checked={weekdays.includes(day.key)}
                  onChange={() => {
                    setWeekdays((current) => {
                      if (current.includes(day.key)) {
                        return current.filter((item) => item !== day.key);
                      }
                      if (current.length >= 2) {
                        return [...current.slice(1), day.key];
                      }
                      return [...current, day.key];
                    });
                  }}
                  inputProps={{ 'data-testid': `ipm-day-${day.key}` } as InputHTMLAttributes<HTMLInputElement>}
                />
              }
              label={day.label}
            />
          ))}
        </Box>
        <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.5 }} data-testid="ipm-schedule-summary">
          {summary}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          <Button
            variant="contained"
            data-testid="ipm-schedule-save"
            disabled={save.isPending}
            onClick={() => {
              if (selected.length !== 0 && selected.length !== 2) {
                setMessage('Choose exactly two days for the twice-a-week IPM schedule, or clear both to turn it off.');
                return;
              }
              setMessage(null);
              save.mutate(selected);
            }}
          >
            Save schedule
          </Button>
          <Button
            data-testid="ipm-schedule-clear"
            disabled={save.isPending}
            onClick={() => {
              setWeekdays([]);
              setMessage(null);
              save.mutate([]);
            }}
          >
            Clear schedule
          </Button>
        </Box>
        {message ? (
          <Alert sx={{ mt: 2 }} severity={message === 'IPM schedule saved.' ? 'success' : 'error'} data-testid="ipm-schedule-message">
            {message}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function labelFor(day: Weekday): string {
  return WEEKDAYS.find((item) => item.key === day)?.label ?? day;
}
