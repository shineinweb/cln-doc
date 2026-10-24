import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PublicLayout, HomePage, PricingPage, LegalPage, LoginPage, RegisterPage, ResetPage } from './pages/public'
import { Shell } from './pages/shell'
import {
  BillingSettings,
  BrandSettings,
  CalendarPage,
  CategoriesSettings,
  CommentsPage,
  CreatePage,
  CustomAiSettings,
  DashboardPage,
  InsightsPage,
  InstagramSettings,
  MessagesPage,
  SettingsLayout,
  TeamSettings,
} from './pages/workspace'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/privacy" element={<LegalPage path="/privacy" />} />
          <Route path="/terms" element={<LegalPage path="/terms" />} />
          <Route path="/data-deletion" element={<LegalPage path="/data-deletion" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPage />} />
        </Route>
        <Route path="/app" element={<Shell />}>
          <Route index element={<DashboardPage />} />
          <Route path="create" element={<CreatePage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="comments" element={<CommentsPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="brand" replace />} />
            <Route path="brand" element={<BrandSettings />} />
            <Route path="ai" element={<CustomAiSettings />} />
            <Route path="categories" element={<CategoriesSettings />} />
            <Route path="team" element={<TeamSettings />} />
            <Route path="billing" element={<BillingSettings />} />
            <Route path="instagram" element={<InstagramSettings />} />
          </Route>
        </Route>
        <Route path="*" element={<PublicLayout missing />} />
      </Routes>
    </BrowserRouter>
  )
}
