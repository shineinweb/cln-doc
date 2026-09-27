import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { PortalLayout } from "./components/PortalLayout";
import { AskAiPage } from "./pages/AskAiPage";
import { HomePage } from "./pages/HomePage";
import { HostingManagePage } from "./pages/HostingManagePage";
import { HostingPage } from "./pages/HostingPage";
import { LoginPage } from "./pages/LoginPage";
import { NewTicketPage } from "./pages/NewTicketPage";
import { TicketsPage } from "./pages/TicketsPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<PortalLayout />}>
            <Route index element={<HomePage />} />
            <Route path="ai" element={<AskAiPage />} />
            <Route path="hosting" element={<HostingPage />} />
            <Route path="hosting/:accountId/manage" element={<HostingManagePage />} />
            <Route path="tickets" element={<TicketsPage />} />
            <Route path="tickets/new" element={<NewTicketPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
