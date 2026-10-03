import { Card, CardContent, Typography } from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { workbench } from '../theme';

export function PlaceholderPage({ kicker, title, lede }: { kicker: string; title: string; lede: string }) {
  return (
    <>
      <PageHeader kicker={kicker} title={title} lede={lede} />
      <Card sx={{ bgcolor: workbench.mist }}>
        <CardContent>
          <Typography>This module is not in the current release.</Typography>
        </CardContent>
      </Card>
    </>
  );
}
