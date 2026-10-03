import { Box } from '@mui/material';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './layout/AppShell';
import { SiteProvider } from './layout/SiteProvider';
import { CompanyPage } from './pages/CompanyPage';
import { CompliancePage } from './pages/CompliancePage';
import { CropCyclePage } from './pages/CropCyclePage';
import { CropCyclesPage } from './pages/CropCyclesPage';
import { FacilityPage } from './pages/FacilityPage';
import { LicenseInventoryPage } from './pages/LicenseInventoryPage';
import { LoginPage } from './pages/LoginPage';
import { PlantPage } from './pages/PlantPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { RoomDashboardPage } from './pages/RoomDashboardPage';
import { RoomsPage } from './pages/RoomsPage';
import { SubmissionPage } from './pages/SubmissionPage';
import { TaskPage } from './pages/TaskPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { WorkspacePage } from './pages/WorkspacePage';

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
      { path: 'workflows', element: <WorkflowsPage /> },
      { path: 'workspace', element: <WorkspacePage /> },
      { path: 'tasks/:taskId', element: <TaskPage /> },
      { path: 'compliance', element: <CompliancePage /> },
      { path: 'licenses/:licenseId', element: <LicenseInventoryPage /> },
      { path: 'plants/:plantId', element: <PlantPage /> },
      { path: 'submissions/:submissionId', element: <SubmissionPage /> },
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
