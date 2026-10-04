import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { RequirePermission } from './auth/RequirePermission';
import { AppShell } from './layout/AppShell';
import { SiteProvider } from './layout/SiteProvider';
import { AccessPage } from './pages/AccessPage';
import { DashboardPage } from './pages/DashboardPage';
import { FacilityPage } from './pages/FacilityPage';
import { CompliancePage } from './pages/CompliancePage';
import { CropCyclePage } from './pages/CropCyclePage';
import { SopPage, UserManualPage } from './pages/GuidePages';
import { GatewayPage } from './pages/GatewayPage';
import { HarvestPage } from './pages/HarvestPage';
import { HarvestsPage } from './pages/HarvestsPage';
import { LicenseInventoryPage } from './pages/LicenseInventoryPage';
import { CommunicationsPage } from './pages/CommunicationsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { MessagesPage } from './pages/MessagesPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { OperationsPage } from './pages/OperationsPage';
import { PackagePage } from './pages/PackagePage';
import { PlantPage } from './pages/PlantPage';
import { ReadingPage } from './pages/ReadingPage';
import { ReportsPage } from './pages/ReportsPage';
import { SiteCoachPage } from './pages/SiteCoachPage';
import { SiteReportPage } from './pages/SiteReportPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { RoomDashboardPage } from './pages/RoomDashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { RoomsPage } from './pages/RoomsPage';
import { SubmissionPage } from './pages/SubmissionPage';
import { TaskPage } from './pages/TaskPage';
import { TimeClockPage } from './pages/TimeClockPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { WorkspacePage } from './pages/WorkspacePage';

function gate(anyOf: string[], element: ReactNode) {
  return <RequirePermission anyOf={anyOf}>{element}</RequirePermission>;
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
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
      { index: true, element: gate(['dashboard.read'], <DashboardPage />) },
      { path: 'facilities', element: gate(['facilities.read', 'sites.read'], <FacilityPage />) },
      { path: 'facility', element: <Navigate to="/rooms" replace /> },
      { path: 'rooms', element: gate(['rooms.read'], <RoomsPage />) },
      { path: 'rooms/:roomId', element: gate(['rooms.read'], <RoomDashboardPage />) },
      { path: 'gateways/:gatewayId', element: gate(['rooms.read'], <GatewayPage />) },
      { path: 'rooms/:roomId/cycles/:cycleId', element: gate(['tasks.read', 'rooms.read'], <CropCyclePage />) },
      { path: 'crop-cycles', element: <Navigate to="/rooms" replace /> },
      { path: 'workflows', element: gate(['workflows.manage'], <WorkflowsPage />) },
      { path: 'workspace', element: gate(['tasks.read'], <WorkspacePage />) },
      { path: 'timeclock', element: gate(['timeclock.punch'], <TimeClockPage />) },
      { path: 'tasks/:taskId', element: gate(['tasks.read'], <TaskPage />) },
      { path: 'compliance', element: gate(['compliance.read'], <CompliancePage />) },
      { path: 'harvests', element: gate(['harvests.read'], <HarvestsPage />) },
      { path: 'harvests/:harvestId', element: gate(['harvests.read'], <HarvestPage />) },
      { path: 'packages/:packageId', element: gate(['harvests.read'], <PackagePage />) },
      { path: 'licenses/:licenseId', element: gate(['inventory.read'], <LicenseInventoryPage />) },
      { path: 'plants/:plantId', element: gate(['inventory.read'], <PlantPage />) },
      { path: 'readings/:readingId', element: gate(['rooms.read'], <ReadingPage />) },
      { path: 'operations', element: gate(['operations.read'], <OperationsPage />) },
      { path: 'operations/:area', element: gate(['operations.read'], <OperationsPage />) },
      { path: 'reports', element: gate(['reports.read'], <ReportsPage />) },
      { path: 'coach', element: gate(['coach.use'], <SiteCoachPage />) },
      { path: 'messages', element: gate(['messages.use'], <MessagesPage />) },
      { path: 'communications', element: gate(['communications.manage'], <CommunicationsPage />) },
      { path: 'user-manual', element: gate(['dashboard.read'], <UserManualPage />) },
      { path: 'sop', element: gate(['operations.read', 'workflows.manage'], <SopPage />) },
      { path: 'settings', element: gate(['settings.manage'], <SettingsPage />) },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'access', element: gate(['access.manage'], <AccessPage />) },
      { path: 'reports/sites/:siteId', element: gate(['reports.read'], <SiteReportPage />) },
      { path: 'submissions/:submissionId', element: gate(['compliance.read'], <SubmissionPage />) },
      {
        path: '*',
        element: (
          <Box>
            <PlaceholderPage kicker="Serenity" title="Page not found" lede="That address is not part of the workspace." />
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
