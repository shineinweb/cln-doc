import { createTheme } from '@mui/material/styles';

export const workbench = {
  ink: '#1A2E28',
  paper: '#FFFFFF',
  canvas: '#E7F4EE',
  line: '#C5DDD2',
  copper: '#E38B4F',
  greenhouse: '#1B7A56',
  greenhouseDeep: '#12352C',
  mist: '#F4FBF8',
  moss: '#3D8F6E',
  leaf: '#14815C',
  sky: '#3E8EBE',
  blossom: '#D4537E',
  gold: '#E4B23C',
};

export const theme = createTheme({
  palette: {
    primary: { main: workbench.leaf, contrastText: '#F4FBF8' },
    secondary: { main: workbench.greenhouseDeep, contrastText: '#F4FBF8' },
    background: { default: workbench.canvas, paper: workbench.paper },
    text: { primary: workbench.ink, secondary: '#4E655C' },
    divider: workbench.line,
    info: { main: workbench.sky },
    warning: { main: workbench.gold },
  },
  typography: {
    fontFamily: '"Outfit", "Segoe UI", sans-serif',
    h1: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600, letterSpacing: '-0.03em' },
    h2: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600, letterSpacing: '-0.03em' },
    h3: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600 },
    button: { fontWeight: 600 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: workbench.canvas },
        '#root': { minHeight: '100vh' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 12, paddingInline: 16, minHeight: 40 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: '#FFFFFF', borderRadius: 12 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${workbench.line}`,
          borderRadius: 16,
          boxShadow: '0 10px 28px rgba(18, 53, 44, 0.07)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, minHeight: 48 },
      },
    },
    MuiTabs: {
      defaultProps: {
        variant: 'scrollable',
        scrollButtons: 'auto',
        allowScrollButtonsMobile: true,
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});

export const ROOM_TYPE_LABELS: Record<string, string> = {
  flower: 'Flower',
  veg: 'Vegetative',
  dry: 'Dry',
  mother: 'Mother',
  clone: 'Clone',
};

const ROOM_TYPE_COLORS: Record<string, string> = {
  flower: workbench.blossom,
  veg: workbench.leaf,
  dry: workbench.gold,
  mother: workbench.sky,
  clone: workbench.moss,
};

export function roomTypeLabel(roomType: string): string {
  return ROOM_TYPE_LABELS[roomType] ?? roomType;
}

export function roomTypeColor(roomType: string): string {
  return ROOM_TYPE_COLORS[roomType] ?? workbench.leaf;
}
