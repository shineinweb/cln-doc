import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { CustomersPage } from "@/pages/CustomersPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LeadsPage } from "@/pages/LeadsPage";
import { LoginPage } from "@/pages/LoginPage";
import { OpportunitiesPage } from "@/pages/OpportunitiesPage";
import { QuotesPage } from "@/pages/QuotesPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="opportunities" element={<OpportunitiesPage />} />
            <Route path="quotes" element={<QuotesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
