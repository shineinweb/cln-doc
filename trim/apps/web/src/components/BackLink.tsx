import { Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

/** Text back control used on detail pages (crop, plant, harvest, …). */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Button component={RouterLink} to={to} sx={{ px: 0, mb: 1 }} data-testid="back-link">
      Back to {label}
    </Button>
  );
}
