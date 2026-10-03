import type { ReactNode } from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import type { OperatingHistory } from '@trim/contracts';
import { formatCalendarDate } from './format';

export function OperatingHistoryView({ history, hideObservations = false }: { history: OperatingHistory; hideObservations?: boolean }) {
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <HistorySection title="Timeline">
        {history.events.length === 0 ? (
          <EmptyLine>No timeline events are recorded.</EmptyLine>
        ) : (
          history.events.map((event) => (
            <Box key={event.id} data-testid="history-event" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontWeight: 600 }}>
                {formatCalendarDate(event.occurredOn)} · {event.title}
              </Typography>
              {event.detail ? <Typography sx={{ color: 'text.secondary' }}>{event.detail}</Typography> : null}
            </Box>
          ))
        )}
      </HistorySection>
      <HistorySection title="Movements">
        {history.movements.length === 0 ? (
          <EmptyLine>No movements are recorded.</EmptyLine>
        ) : (
          history.movements.map((movement) => (
            <Box key={movement.id} sx={{ mb: 1.5 }}>
              <Typography sx={{ fontWeight: 600 }}>
                {formatCalendarDate(movement.occurredOn)} · {movement.fromLabel} → {movement.toLabel}
              </Typography>
              <Typography sx={{ color: 'text.secondary' }}>
                {movement.plantCount} plants{movement.note ? ` · ${movement.note}` : ''}
              </Typography>
            </Box>
          ))
        )}
      </HistorySection>
      {hideObservations ? null : (
        <HistorySection title="Observations">
          {history.observations.length === 0 ? (
            <EmptyLine>No observations are recorded.</EmptyLine>
          ) : (
            history.observations.map((observation) => (
              <Box key={observation.id} sx={{ mb: 1.5 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  {formatCalendarDate(observation.occurredOn)} · {observation.authorName}
                </Typography>
                <Typography sx={{ color: 'text.secondary' }}>{observation.body}</Typography>
              </Box>
            ))
          )}
        </HistorySection>
      )}
      <HistorySection title="Labor">
        {history.laborEntries.length === 0 ? (
          <EmptyLine>No labor entries are recorded.</EmptyLine>
        ) : (
          history.laborEntries.map((entry) => (
            <Box key={entry.id} sx={{ mb: 1.5 }}>
              <Typography sx={{ fontWeight: 600 }}>
                {formatCalendarDate(entry.occurredOn)} · {entry.personName} · {entry.hours} h
              </Typography>
              {entry.note ? <Typography sx={{ color: 'text.secondary' }}>{entry.note}</Typography> : null}
            </Box>
          ))
        )}
      </HistorySection>
      <HistorySection title="Harvest result">
        {history.harvestSummary ? (
          <Box>
            <Typography sx={{ fontWeight: 600 }}>{formatCalendarDate(history.harvestSummary.recordedOn)}</Typography>
            <Typography sx={{ color: 'text.secondary' }}>{history.harvestSummary.summary}</Typography>
          </Box>
        ) : (
          <EmptyLine>No harvest result is recorded for this cycle.</EmptyLine>
        )}
      </HistorySection>
    </Box>
  );
}

function HistorySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h3" sx={{ fontSize: 22, mb: 1.5 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function EmptyLine({ children }: { children: string }) {
  return <Typography sx={{ color: 'text.secondary' }}>{children}</Typography>;
}
