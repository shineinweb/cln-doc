import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { AboutPage } from "@/pages/AboutPage";
import { BlogPage } from "@/pages/BlogPage";
import { BlogPostPage } from "@/pages/BlogPostPage";
import { ContactPage } from "@/pages/ContactPage";
import { DomainsPage } from "@/pages/DomainsPage";
import { HomePage } from "@/pages/HomePage";
import { HostingPage } from "@/pages/HostingPage";
import { KnowledgeArticlePage } from "@/pages/KnowledgeArticlePage";
import { KnowledgeBasePage } from "@/pages/KnowledgeBasePage";
import { LoginPage } from "@/pages/LoginPage";
import { PortfolioPage } from "@/pages/PortfolioPage";
import { PricingPage } from "@/pages/PricingPage";
import { RequestQuotePage } from "@/pages/RequestQuotePage";
import { ServiceDetailPage } from "@/pages/ServiceDetailPage";
import { ServicesPage } from "@/pages/ServicesPage";

export function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route
              path="services/web-development"
              element={<ServiceDetailPage slug="web-development" />}
            />
            <Route
              path="services/graphic-design"
              element={<ServiceDetailPage slug="graphic-design" />}
            />
            <Route path="services/seo" element={<ServiceDetailPage slug="seo" />} />
            <Route
              path="services/ai-development"
              element={<ServiceDetailPage slug="ai-development" />}
            />
            <Route path="hosting" element={<HostingPage />} />
            <Route path="domains" element={<DomainsPage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="blog" element={<BlogPage />} />
            <Route path="blog/:slug" element={<BlogPostPage />} />
            <Route path="knowledge-base" element={<KnowledgeBasePage />} />
            <Route path="knowledge-base/:slug" element={<KnowledgeArticlePage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="request-quote" element={<RequestQuotePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
}
