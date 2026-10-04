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
  Tooltip,
  Typography,
} from '@mui/material';
import { facilityBoardSchema, type FacilityBoardCell, type FacilityBoardColumn } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { apiGet } from '../api/client';
import { displayFont, roomTypeColor, workbench } from '../theme';

const STATUS_STYLE: Record<
  Exclude<FacilityBoardCell['status'], 'empty'>,
  { color: string; bg: string; label: string }
> = {
  done: { color: workbench.greenhouse, bg: 'rgba(46, 230, 166, 0.12)', label: 'Done' },
  due: { color: workbench.gold, bg: 'rgba(255, 209, 102, 0.14)', label: 'Due' },
  overdue: { color: workbench.copper, bg: 'rgba(255, 138, 61, 0.14)', label: 'Overdue' },
  scheduled: { color: workbench.ink, bg: 'rgba(246, 243, 255, 0.06)', label: 'Scheduled' },
};

export function FacilityBoard({ siteId }: { siteId: string }) {
  const board = useQuery({
    queryKey: ['facility-board', siteId],
    queryFn: () => apiGet(`/sites/${siteId}/board`, facilityBoardSchema),
  });

  if (board.isPending) {
    return <Skeleton variant="rounded" height={280} sx={{ mb: 3 }} data-testid="facility-board-loading" />;
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
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" sx={{ fontSize: 26, mb: 0.35 }}>
            Facility board
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 14, maxWidth: 640 }}>
            {data.siteName}: rooms × milestones for the selected facility. Scroll sideways for every chore column.
          </Typography>
        </Box>
        <Box
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
          data-testid="facility-board-legend"
          aria-label="Status legend"
        >
          {(Object.keys(STATUS_STYLE) as Array<keyof typeof STATUS_STYLE>).map((status) => (
            <Box
              key={status}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
                px: 1,
                py: 0.35,
                borderRadius: 999,
                border: `1px solid ${workbench.line}`,
                bgcolor: STATUS_STYLE[status].bg,
                color: STATUS_STYLE[status].color,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'currentColor' }} />
              {STATUS_STYLE[status].label}
            </Box>
          ))}
        </Box>
      </Box>

      {data.rows.length === 0 ? (
        <Alert severity="info">No rooms are recorded for this facility.</Alert>
      ) : (
        <Box
          sx={{
            border: `1px solid ${workbench.line}`,
            borderRadius: 2,
            bgcolor: workbench.paper,
            overflow: 'hidden',
            maxWidth: '100%',
          }}
        >
          <TableContainer
            data-testid="facility-board-scroll"
            sx={{
              overflowX: 'auto',
              maxWidth: '100%',
              width: '100%',
              overscrollBehaviorX: 'contain',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
              scrollbarGutter: 'stable',
            }}
          >
            <Table
              size="small"
              stickyHeader
              sx={{
                minWidth: Math.max(880, 112 + data.columns.length * 92),
                width: 'max-content',
                tableLayout: 'fixed',
                borderCollapse: 'separate',
                borderSpacing: 0,
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      fontFamily: displayFont,
                      fontWeight: 700,
                      bgcolor: workbench.mist,
                      position: 'sticky',
                      left: 0,
                      zIndex: 4,
                      width: 112,
                      minWidth: 112,
                      maxWidth: 112,
                      boxShadow: `4px 0 12px rgba(8, 4, 24, 0.35)`,
                      borderBottom: `1px solid ${workbench.line}`,
                    }}
                  >
                    Room
                  </TableCell>
                  {data.columns.map((column) => (
                    <TableCell
                      key={column.key}
                      align="center"
                      title={columnTooltip(column)}
                      sx={{
                        fontWeight: 700,
                        bgcolor: workbench.mist,
                        color: kindColor(column.kind),
                        whiteSpace: 'nowrap',
                        width: 92,
                        minWidth: 92,
                        maxWidth: 92,
                        px: 0.75,
                        fontSize: 12,
                        letterSpacing: column.label.length <= 2 ? '0.04em' : 0,
                        borderBottom: `1px solid ${workbench.line}`,
                      }}
                    >
                      <Tooltip title={columnTooltip(column)} arrow placement="top">
                        <Box component="span" sx={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {column.label}
                        </Box>
                      </Tooltip>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.map((row, rowIndex) => {
                  const rowBg = rowIndex % 2 === 0 ? workbench.paper : 'rgba(38, 31, 66, 0.45)';
                  return (
                    <TableRow
                      key={row.roomId}
                      hover
                      data-testid={`facility-board-row-${row.roomId}`}
                      sx={{
                        bgcolor: rowBg,
                        '&:hover .facility-board-room-cell': {
                          bgcolor: 'rgba(124, 92, 255, 0.16)',
                        },
                      }}
                    >
                      <TableCell
                        className="facility-board-room-cell"
                        sx={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 2,
                          bgcolor: rowBg,
                          borderLeft: `4px solid ${roomTypeColor(row.roomType)}`,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          width: 112,
                          minWidth: 112,
                          maxWidth: 112,
                          boxShadow: `4px 0 12px rgba(8, 4, 24, 0.28)`,
                          verticalAlign: 'middle',
                          py: 1.1,
                        }}
                      >
                        <RouterLink to={`/rooms/${row.roomId}`} style={{ color: workbench.sky, textDecoration: 'none' }}>
                          {row.roomName}
                        </RouterLink>
                        {row.cycleName || row.cultivar ? (
                          <Typography
                            sx={{
                              color: 'text.secondary',
                              fontSize: 11,
                              fontWeight: 600,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              mt: 0.2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {row.cultivar || row.cycleName}
                          </Typography>
                        ) : null}
                      </TableCell>
                      {row.cells.map((cell) => (
                        <BoardCell key={cell.columnKey} cell={cell} />
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {data.notes.length > 0 ? (
        <Box sx={{ mt: 1.5, display: 'grid', gap: 0.5 }} data-testid="facility-board-notes">
          {data.notes.map((note) => (
            <Typography
              key={note}
              sx={{
                color: 'text.secondary',
                fontSize: 13,
                pl: 1.25,
                borderLeft: `2px solid ${workbench.violet}`,
              }}
            >
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
      <TableCell
        align="center"
        sx={{
          color: 'rgba(196, 182, 228, 0.35)',
          fontSize: 13,
          width: 92,
          minWidth: 92,
          maxWidth: 92,
          px: 0.5,
        }}
      >
        —
      </TableCell>
    );
  }

  const style = STATUS_STYLE[cell.status];
  const label = cell.dates.length > 0 ? cell.dates.map(formatBoardDate).join(' · ') : cell.detail ?? '•';
  const tip = [style.label, cell.detail, cell.dates.join(', ')].filter(Boolean).join(' · ');

  return (
    <TableCell
      align="center"
      title={tip}
      data-status={cell.status}
      sx={{
        width: 92,
        minWidth: 92,
        maxWidth: 92,
        px: 0.5,
        py: 0.85,
        verticalAlign: 'middle',
      }}
    >
      <Tooltip title={tip} arrow>
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 52,
            maxWidth: 84,
            px: 0.85,
            py: 0.4,
            borderRadius: 1.25,
            bgcolor: style.bg,
            color: style.color,
            border: `1px solid ${style.color}55`,
            fontWeight: cell.status === 'due' || cell.status === 'overdue' ? 800 : 600,
            fontSize: 12,
            lineHeight: 1.2,
            textDecoration: cell.status === 'done' ? 'line-through' : 'none',
            textDecorationThickness: 1.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </Box>
      </Tooltip>
    </TableCell>
  );
}

function kindColor(kind: FacilityBoardColumn['kind']): string {
  if (kind === 'defoliation' || kind === 'harvest') {
    return workbench.leaf;
  }
  if (kind === 'trim') {
    return workbench.sky;
  }
  if (kind === 'start') {
    return workbench.greenhouse;
  }
  return workbench.ink;
}

function columnTooltip(column: FacilityBoardColumn): string {
  switch (column.kind) {
    case 'start':
      return 'Crop start (1st)';
    case 'defoliation':
      return column.dayNumber != null ? `Defoliation day ${column.dayNumber}` : 'Defoliation';
    case 'harvest':
      return 'Harvest';
    case 'trim':
      return 'Trim';
    case 'chore':
      return `${column.label} chore / duty`;
    default:
      return column.label;
  }
}

/** Whiteboard-style month.day (UTC calendar key). */
function formatBoardDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number);
  if (!month || !day) {
    return isoDate;
  }
  return `${month}.${day}`;
}
