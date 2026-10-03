import { Box, Typography } from '@mui/material';

export function PageHeader({ kicker, title, lede }: { kicker?: string; title: string; lede: string }) {
  return (
    <Box sx={{ mb: 3 }}>
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
      <Typography sx={{ mt: 1.25, maxWidth: 640, color: 'text.secondary', fontSize: 17 }}>{lede}</Typography>
    </Box>
  );
}
