import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { InvoicesPage } from "@/pages/billing/InvoicesPage";
import { PaymentsPage } from "@/pages/billing/PaymentsPage";
import { PricesPage } from "@/pages/billing/PricesPage";
import { ProductsPage } from "@/pages/billing/ProductsPage";
import { RefundsPage } from "@/pages/billing/RefundsPage";
import { SubscriptionsPage } from "@/pages/billing/SubscriptionsPage";
import { WebhooksPage } from "@/pages/billing/WebhooksPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LeadsPage } from "@/pages/LeadsPage";
import { LoginPage } from "@/pages/LoginPage";
import { OpportunitiesPage } from "@/pages/OpportunitiesPage";
import { QuoteDetailPage } from "@/pages/QuoteDetailPage";
import { QuotesPage } from "@/pages/QuotesPage";
import { AiPage } from "@/pages/AiPage";
import { KnowledgePage } from "@/pages/KnowledgePage";
import { TicketsPage } from "@/pages/TicketsPage";

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
            <Route path="quotes/:quoteId" element={<QuoteDetailPage />} />
            <Route path="tickets" element={<TicketsPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="ai" element={<AiPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="prices" element={<PricesPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="refunds" element={<RefundsPage />} />
            <Route path="webhooks" element={<WebhooksPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
