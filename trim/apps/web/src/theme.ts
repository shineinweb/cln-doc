import { createTheme } from '@mui/material/styles';

export const displayFont = '"Syne", "Trebuchet MS", sans-serif';
export const bodyFont = '"Plus Jakarta Sans", "Segoe UI", sans-serif';

export const workbench = {
  ink: '#F6F3FF',
  paper: '#1C1733',
  canvas: '#100E1C',
  line: '#3C335C',
  copper: '#FF8A3D',
  greenhouse: '#2EE6A6',
  greenhouseDeep: '#140E28',
  mist: '#261F42',
  moss: '#8B6CFF',
  leaf: '#FF4F8B',
  sky: '#3DDCFF',
  blossom: '#FF4F8B',
  gold: '#FFD166',
  violet: '#7C5CFF',
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: workbench.leaf, contrastText: '#FFF7FB' },
    secondary: { main: workbench.sky, contrastText: '#07141A' },
    background: { default: workbench.canvas, paper: workbench.paper },
    text: { primary: workbench.ink, secondary: '#C4B6E4' },
    divider: workbench.line,
    info: { main: workbench.sky },
    warning: { main: workbench.gold },
    success: { main: workbench.greenhouse },
  },
  typography: {
    fontFamily: bodyFont,
    h1: { fontFamily: displayFont, fontWeight: 700, letterSpacing: '-0.04em' },
    h2: { fontFamily: displayFont, fontWeight: 700, letterSpacing: '-0.03em' },
    h3: { fontFamily: displayFont, fontWeight: 700 },
    button: { fontFamily: bodyFont, fontWeight: 700 },
    overline: { fontFamily: bodyFont, fontWeight: 700 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          overflowX: 'hidden',
          maxWidth: '100%',
        },
        body: {
          backgroundColor: workbench.canvas,
          color: workbench.ink,
          fontFamily: bodyFont,
          overflowX: 'hidden',
          maxWidth: '100%',
        },
        '#root': { minHeight: '100vh', maxWidth: '100%', overflowX: 'hidden' },
        a: { color: workbench.sky },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 12, paddingInline: 16, minHeight: 40 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: workbench.mist, borderRadius: 12 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(180deg, rgba(124, 92, 255, 0.16), rgba(255, 79, 139, 0.05) 42%, transparent 70%)',
          backgroundColor: workbench.paper,
          border: `1px solid ${workbench.line}`,
          borderRadius: 16,
          boxShadow: '0 16px 36px rgba(18, 8, 40, 0.45)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 700, minHeight: 48 },
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
        root: { fontWeight: 700 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: { minWidth: 560 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(38, 31, 66, 0.92)',
          '& .MuiTableCell-root': {
            color: '#C4B6E4',
            fontWeight: 700,
            fontSize: 13,
            borderBottom: `1px solid ${workbench.line}`,
            whiteSpace: 'nowrap',
          },
        },
      },
    },
    MuiTableBody: {
      styleOverrides: {
        root: {
          '& .MuiTableRow-root:nth-of-type(even)': {
            backgroundColor: 'rgba(38, 31, 66, 0.35)',
          },
          '& .MuiTableRow-root:hover': {
            backgroundColor: 'rgba(124, 92, 255, 0.12)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${workbench.line}`,
          color: workbench.ink,
          fontSize: 14,
          paddingTop: 12,
          paddingBottom: 12,
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
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

const ROOM_TYPE_COLORS: Record<string, string> = {
  flower: workbench.blossom,
  veg: workbench.greenhouse,
  dry: workbench.gold,
  mother: workbench.sky,
  clone: workbench.violet,
};

export function roomTypeLabel(roomType: string): string {
  return ROOM_TYPE_LABELS[roomType] ?? roomType;
}

export function roomTypeColor(roomType: string): string {
  return ROOM_TYPE_COLORS[roomType] ?? workbench.leaf;
}
