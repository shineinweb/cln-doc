/**
 * DEVELOPMENT PLACEHOLDER DATA
 * Replace with CMS/API content before production launch.
 */

export const COMPANY = {
  name: "Agency AI",
  tagline: "Digital products, infrastructure, and intelligence — built to convert.",
  email: "hello@agency-ai.local",
  phone: "+1 (555) 010-2040",
  address: "Development placeholder address — replace with HQ",
} as const;

export const NAV_PRIMARY = [
  { to: "/services", label: "Services" },
  { to: "/hosting", label: "Hosting" },
  { to: "/domains", label: "Domains" },
  { to: "/pricing", label: "Pricing" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/about", label: "About" },
  { to: "/blog", label: "Blog" },
  { to: "/knowledge-base", label: "Knowledge Base" },
  { to: "/contact", label: "Contact" },
] as const;

export const SERVICES = [
  {
    slug: "web-development",
    title: "Web Programming",
    summary: "Custom web applications, APIs, and product engineering.",
    path: "/services/web-development",
  },
  {
    slug: "graphic-design",
    title: "Web & Graphic Design",
    summary: "Brand systems, marketing sites, and visual identity.",
    path: "/services/graphic-design",
  },
  {
    slug: "seo",
    title: "SEO",
    summary: "Technical SEO, content strategy, and measurable growth.",
    path: "/services/seo",
  },
  {
    slug: "ai-development",
    title: "AI Development",
    summary: "Custom agents, RAG, and automation for your operations.",
    path: "/services/ai-development",
  },
  {
    slug: "hosting",
    title: "Web & Managed Hosting",
    summary: "Reliable hosting with proactive care and monitoring.",
    path: "/hosting",
  },
  {
    slug: "domains",
    title: "Domain Registration",
    summary: "Search, register, and manage domains in one place.",
    path: "/domains",
  },
] as const;

export const HOSTING_PLANS = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 19,
    blurb: "Launch sites with essentials and email-ready DNS.",
    features: ["1 site", "25 GB SSD", "Free SSL", "Daily backups (dev placeholder)"],
    highlighted: false,
  },
  {
    id: "growth",
    name: "Growth",
    priceMonthly: 49,
    blurb: "For growing brands that need speed and staging.",
    features: ["5 sites", "100 GB SSD", "Staging", "Priority support (placeholder)"],
    highlighted: true,
  },
  {
    id: "managed",
    name: "Managed",
    priceMonthly: 149,
    blurb: "Hands-on operations for mission-critical properties.",
    features: ["Unlimited sites*", "CDN assist", "Patching", "Uptime watch"],
    highlighted: false,
  },
] as const;

export const PORTFOLIO = [
  {
    slug: "northline-commerce",
    title: "Northline Commerce",
    category: "Web Programming",
    summary: "Headless storefront rebuild with conversion-focused UX.",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=80",
  },
  {
    slug: "atelier-brand",
    title: "Atelier Brand System",
    category: "Graphic Design",
    summary: "Identity, packaging, and web art direction.",
    image:
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1400&q=80",
  },
  {
    slug: "signal-seo",
    title: "Signal SEO Program",
    category: "SEO",
    summary: "Technical cleanup and content clusters for organic lift.",
    image:
      "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?auto=format&fit=crop&w=1400&q=80",
  },
  {
    slug: "harbor-ai",
    title: "Harbor Support AI",
    category: "AI Development",
    summary: "Knowledge-grounded assistant for customer operations.",
    image:
      "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1400&q=80",
  },
] as const;

export const BLOG_POSTS = [
  {
    slug: "launch-checklist-2026",
    title: "A practical launch checklist for modern sites",
    excerpt: "Performance, SEO, and ops gates we run before go-live.",
    date: "2026-03-01",
    tag: "Engineering",
  },
  {
    slug: "rag-without-drama",
    title: "RAG without drama: grounding support answers",
    excerpt: "How we structure knowledge so agents stay trustworthy.",
    date: "2026-02-12",
    tag: "AI",
  },
  {
    slug: "hosting-that-stays-quiet",
    title: "Hosting that stays quiet",
    excerpt: "Managed hosting practices that reduce 2 a.m. pages.",
    date: "2026-01-20",
    tag: "Hosting",
  },
] as const;

export const KB_ARTICLES = [
  {
    slug: "connect-domain-dns",
    title: "Connect a domain with DNS records",
    excerpt: "A-records, CNAME, and propagation expectations.",
    category: "Domains",
  },
  {
    slug: "enable-ssl",
    title: "Enable SSL on your hosting plan",
    excerpt: "How certificates are provisioned on our stacks.",
    category: "Hosting",
  },
  {
    slug: "request-quote-tips",
    title: "How to write a strong project brief",
    excerpt: "What we need to scope accurately and quickly.",
    category: "Projects",
  },
] as const;

export const PLACEHOLDER_NOTICE = "Development placeholder content — not production CMS data.";
