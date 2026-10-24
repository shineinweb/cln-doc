import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuditPage, DashboardPage, LoginPage, OrganizationDetail, OrganizationsPage, PackagesPage, SeoPage, SettingsPage, Shell, StaffPage, SubscriptionsPage, UsagePage, UsersPage } from './pages'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Shell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/organizations" element={<OrganizationsPage />} />
          <Route path="/organizations/:id" element={<OrganizationDetail />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/packages" element={<PackagesPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/seo" element={<SeoPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/staff" element={<StaffPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
