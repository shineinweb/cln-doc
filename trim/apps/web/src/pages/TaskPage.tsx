import { Alert, Box, Skeleton } from '@mui/material';
import { cycleTaskDetailSchema } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ApiError, apiGet } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { AssignmentCard } from '../tasks/AssignmentCard';

export function TaskPage() {
  const { taskId = '' } = useParams();
  const task = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => apiGet(`/tasks/${taskId}`, cycleTaskDetailSchema),
    enabled: Boolean(taskId),
    retry: false,
  });

  if (task.isPending) {
    return <Skeleton variant="rounded" height={220} />;
  }
  if (task.error instanceof ApiError && (task.error.status === 403 || task.error.status === 404)) {
    return (
      <Alert severity="warning" data-testid="task-access-warning">
        {task.error.status === 403 ? 'You do not have access to this assignment.' : 'This assignment was not found.'}
      </Alert>
    );
  }
  if (task.error || !task.data) {
    return <Alert severity="error">{task.error?.message ?? 'This assignment could not be loaded.'}</Alert>;
  }

  return (
    <Box>
      <PageHeader kicker={task.data.siteName} title={task.data.title} lede={task.data.roomName} />
      <AssignmentCard task={task.data} />
    </Box>
  );
}
