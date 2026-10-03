import { Alert, Box, Skeleton, Typography } from '@mui/material';
import { workspaceTodaySchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { formatCalendarDate } from '../crops/format';
import { AssignmentCard } from '../tasks/AssignmentCard';

export function WorkspacePage() {
  const workspace = useQuery({
    queryKey: ['workspace'],
    queryFn: () => apiGet('/workspace/today', workspaceTodaySchema),
  });

  if (workspace.isPending) {
    return <Skeleton variant="rounded" height={220} />;
  }
  if (workspace.error || !workspace.data) {
    return <Alert severity="error">{workspace.error?.message ?? 'Assignments could not be loaded.'}</Alert>;
  }

  return (
    <Box>
      <PageHeader
        kicker="Today"
        title="Employee workspace"
        lede={`Assignments due ${formatCalendarDate(workspace.data.date)}. Tasks from another facility stay off this list.`}
      />
      {workspace.data.tasks.length === 0 ? (
        <Typography data-testid="workspace-empty" sx={{ color: 'text.secondary' }}>
          Nothing is assigned to you today.
        </Typography>
      ) : (
        workspace.data.tasks.map((task) => <AssignmentCard key={task.id} task={task} />)
      )}
    </Box>
  );
}
