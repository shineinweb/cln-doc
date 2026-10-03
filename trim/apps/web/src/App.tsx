import { Box } from '@mui/material';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './layout/AppShell';
import { SiteProvider } from './layout/SiteProvider';
import { CompanyPage } from './pages/CompanyPage';
import { CropCyclePage } from './pages/CropCyclePage';
import { CropCyclesPage } from './pages/CropCyclesPage';
import { FacilityPage } from './pages/FacilityPage';
import { LoginPage } from './pages/LoginPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { RoomDashboardPage } from './pages/RoomDashboardPage';
import { RoomsPage } from './pages/RoomsPage';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <SiteProvider>
          <AppShell />
        </SiteProvider>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <CompanyPage /> },
      { path: 'facility', element: <FacilityPage /> },
      { path: 'rooms', element: <RoomsPage /> },
      { path: 'rooms/:roomId', element: <RoomDashboardPage /> },
      { path: 'rooms/:roomId/cycles/:cycleId', element: <CropCyclePage /> },
      { path: 'crop-cycles', element: <CropCyclesPage /> },
      {
        path: 'workspace',
        element: (
          <PlaceholderPage
            kicker="Later"
            title="Employee workspace"
            lede="Personal task lists and shift notes are not part of this release."
          />
        ),
      },
      {
        path: 'compliance',
        element: (
          <PlaceholderPage
            kicker="Later"
            title="Compliance"
            lede="License records are stored apart from facilities so later inventory can be scoped to a license. This screen does not file reports."
          />
        ),
      },
      {
        path: '*',
        element: (
          <Box>
            <PlaceholderPage kicker="Trim" title="Page not found" lede="That address is not part of the workspace." />
          </Box>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
