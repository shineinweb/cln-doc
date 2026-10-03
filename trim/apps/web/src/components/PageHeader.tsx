import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Mark } from './Mark';

export function PageHeader({
  kicker,
  title,
  lede,
  action,
}: {
  kicker?: string;
  title: string;
  lede: string;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ mb: 3, display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flex: '1 1 240px', minWidth: 0 }}>
        <Box sx={{ mt: 0.4, display: { xs: 'none', sm: 'block' } }}>
          <Mark size={32} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {kicker ? (
            <Typography
              variant="overline"
              sx={{ color: 'primary.main', letterSpacing: '0.16em', fontWeight: 600 }}
            >
              {kicker}
            </Typography>
          ) : null}
          <Typography variant="h1" sx={{ fontSize: { xs: 34, md: 44 }, lineHeight: 1.05 }}>
            {title}
          </Typography>
          <Typography sx={{ mt: 1.25, maxWidth: 680, color: 'text.secondary', fontSize: { xs: 16, md: 17 } }}>{lede}</Typography>
        </Box>
      </Box>
      {action ? <Box sx={{ ml: 'auto', flexShrink: 0 }}>{action}</Box> : null}
    </Box>
  );
}
