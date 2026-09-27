import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { PortalLayout } from "./components/PortalLayout";
import { HomePage } from "./pages/HomePage";
import { HostingManagePage } from "./pages/HostingManagePage";
import { HostingPage } from "./pages/HostingPage";
import { LoginPage } from "./pages/LoginPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<PortalLayout />}>
            <Route index element={<HomePage />} />
            <Route path="hosting" element={<HostingPage />} />
            <Route path="hosting/:accountId/manage" element={<HostingManagePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
