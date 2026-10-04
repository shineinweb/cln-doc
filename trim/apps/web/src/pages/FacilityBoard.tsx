import {
  Alert,
  Box,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { facilityBoardSchema, type FacilityBoardCell } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet } from '../api/client';
import { displayFont, roomTypeColor, workbench } from '../theme';

export function FacilityBoard({ siteId }: { siteId: string }) {
  const board = useQuery({
    queryKey: ['facility-board', siteId],
    queryFn: () => apiGet(`/sites/${siteId}/board`, facilityBoardSchema),
  });

  if (board.isPending) {
    return <Skeleton variant="rounded" height={280} sx={{ mb: 3 }} />;
  }
  if (board.error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {board.error.message}
      </Alert>
    );
  }
  if (!board.data) {
    return null;
  }

  const data = board.data;
  return (
    <Box data-testid="facility-board" sx={{ mb: 4 }}>
      <Typography variant="h2" sx={{ fontSize: 26, mb: 0.75 }}>
        Facility board
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 1.5, fontSize: 14 }}>{data.statement}</Typography>
      {data.rows.length === 0 ? (
        <Alert severity="info">No rooms are recorded for this facility.</Alert>
      ) : (
        <TableContainer
          sx={{
            border: `1px solid ${workbench.line}`,
            borderRadius: 2,
            bgcolor: workbench.paper,
            overflowX: 'auto',
          }}
        >
          <Table size="small" stickyHeader sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontFamily: displayFont,
                    fontWeight: 700,
                    bgcolor: workbench.mist,
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    minWidth: 96,
                  }}
                >
                  Room
                </TableCell>
                {data.columns.map((column) => (
                  <TableCell
                    key={column.key}
                    align="center"
                    sx={{
                      fontWeight: 700,
                      bgcolor: workbench.mist,
                      color: column.kind === 'defoliation' || column.kind === 'harvest' ? workbench.leaf : workbench.ink,
                      whiteSpace: 'nowrap',
                      minWidth: 72,
                    }}
                  >
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.roomId} hover data-testid={`facility-board-row-${row.roomId}`}>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      bgcolor: workbench.paper,
                      borderLeft: `4px solid ${roomTypeColor(row.roomType)}`,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <RouterLink to={`/rooms/${row.roomId}`}>{row.roomName}</RouterLink>
                    {row.cycleName ? (
                      <Typography sx={{ color: 'text.secondary', fontSize: 12, fontWeight: 500 }}>
                        {row.cycleName}
                      </Typography>
                    ) : null}
                  </TableCell>
                  {row.cells.map((cell) => (
                    <BoardCell key={cell.columnKey} cell={cell} />
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {data.notes.length > 0 ? (
        <Box sx={{ mt: 1.25, display: 'grid', gap: 0.35 }} data-testid="facility-board-notes">
          {data.notes.map((note) => (
            <Typography key={note} sx={{ color: 'text.secondary', fontSize: 13 }}>
              {note}
            </Typography>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function BoardCell({ cell }: { cell: FacilityBoardCell }) {
  if (cell.status === 'empty') {
    return (
      <TableCell align="center" sx={{ color: workbench.line, fontSize: 13 }}>
        —
      </TableCell>
    );
  }
  const color =
    cell.status === 'done'
      ? workbench.greenhouse
      : cell.status === 'overdue'
        ? workbench.copper
        : cell.status === 'due'
          ? workbench.gold
          : workbench.ink;
  return (
    <TableCell
      align="center"
      title={cell.detail ?? undefined}
      data-status={cell.status}
      sx={{
        color,
        fontWeight: cell.status === 'due' || cell.status === 'overdue' ? 700 : 500,
        textDecoration: cell.status === 'done' ? 'line-through' : 'none',
        fontSize: 13,
        whiteSpace: 'nowrap',
      }}
    >
      {cell.dates.length > 0 ? cell.dates.map(formatBoardDate).join(' · ') : cell.detail ?? '•'}
    </TableCell>
  );
}

/** Whiteboard-style month.day (UTC calendar key). */
function formatBoardDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number);
  if (!month || !day) {
    return isoDate;
  }
  return `${month}.${day}`;
}
