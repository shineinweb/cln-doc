import { Box } from '@mui/material';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './layout/AppShell';
import { SiteProvider } from './layout/SiteProvider';
import { FacilityPage } from './pages/FacilityPage';
import { CompliancePage } from './pages/CompliancePage';
import { CropCyclePage } from './pages/CropCyclePage';
import { CropCyclesPage } from './pages/CropCyclesPage';
import { SopPage, UserManualPage } from './pages/GuidePages';
import { GatewayPage } from './pages/GatewayPage';
import { HarvestPage } from './pages/HarvestPage';
import { HarvestsPage } from './pages/HarvestsPage';
import { LicenseInventoryPage } from './pages/LicenseInventoryPage';
import { LoginPage } from './pages/LoginPage';
import { OperationsPage } from './pages/OperationsPage';
import { PackagePage } from './pages/PackagePage';
import { PlantPage } from './pages/PlantPage';
import { ReadingPage } from './pages/ReadingPage';
import { ReportsPage } from './pages/ReportsPage';
import { SiteReportPage } from './pages/SiteReportPage';
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
      { index: true, element: <FacilityPage /> },
      { path: 'facility', element: <Navigate to="/rooms" replace /> },
      { path: 'rooms', element: <RoomsPage /> },
      { path: 'rooms/:roomId', element: <RoomDashboardPage /> },
      { path: 'gateways/:gatewayId', element: <GatewayPage /> },
      { path: 'rooms/:roomId/cycles/:cycleId', element: <CropCyclePage /> },
      { path: 'crop-cycles', element: <CropCyclesPage /> },
      { path: 'workflows', element: <WorkflowsPage /> },
      { path: 'workspace', element: <WorkspacePage /> },
      { path: 'tasks/:taskId', element: <TaskPage /> },
      { path: 'compliance', element: <CompliancePage /> },
      { path: 'harvests', element: <HarvestsPage /> },
      { path: 'harvests/:harvestId', element: <HarvestPage /> },
      { path: 'packages/:packageId', element: <PackagePage /> },
      { path: 'licenses/:licenseId', element: <LicenseInventoryPage /> },
      { path: 'plants/:plantId', element: <PlantPage /> },
      { path: 'readings/:readingId', element: <ReadingPage /> },
      { path: 'operations', element: <OperationsPage /> },
      { path: 'operations/:area', element: <OperationsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'user-manual', element: <UserManualPage /> },
      { path: 'sop', element: <SopPage /> },
      { path: 'reports/sites/:siteId', element: <SiteReportPage /> },
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
