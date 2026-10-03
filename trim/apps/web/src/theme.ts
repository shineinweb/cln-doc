import { createTheme } from '@mui/material/styles';

export const workbench = {
  ink: '#1A1814',
  paper: '#F7F4EE',
  canvas: '#E7E1D6',
  line: '#D5CFC3',
  copper: '#B8431F',
  greenhouse: '#24362C',
  greenhouseDeep: '#1A2821',
  mist: '#FBF9F5',
  moss: '#5E6B52',
};

export const theme = createTheme({
  palette: {
    primary: { main: workbench.copper, contrastText: '#FFF8F4' },
    secondary: { main: workbench.greenhouse, contrastText: '#F4EFE6' },
    background: { default: workbench.canvas, paper: workbench.paper },
    text: { primary: workbench.ink, secondary: '#5C564C' },
    divider: workbench.line,
  },
  typography: {
    fontFamily: '"Outfit", "Segoe UI", sans-serif',
    h1: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600, letterSpacing: '-0.03em' },
    h2: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600, letterSpacing: '-0.03em' },
    h3: { fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600 },
    button: { fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 10, paddingInline: 16 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: '#FFFcf8' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${workbench.line}`,
          boxShadow: 'none',
        },
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

export function roomTypeLabel(roomType: string): string {
  return ROOM_TYPE_LABELS[roomType] ?? roomType;
}
