import { Box, Typography } from '@mui/material';
import { Mark } from './Mark';

export function PageHeader({ kicker, title, lede }: { kicker?: string; title: string; lede: string }) {
  return (
    <Box sx={{ mb: 3, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
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
  );
}
