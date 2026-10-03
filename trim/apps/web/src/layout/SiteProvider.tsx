import { siteListSchema, type Site } from '@trim/contracts';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../api/client';
import { SITE_KEY } from '../auth/storage';

interface SiteContextValue {
  sites: Site[];
  site: Site | null;
  siteId: string | null;
  loading: boolean;
  error: Error | null;
  setSiteId: (id: string, options?: { navigate?: boolean }) => void;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [siteId, setSiteIdState] = useState<string | null>(() => sessionStorage.getItem(SITE_KEY));
  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiGet('/sites', siteListSchema),
    retry: false,
  });

  useEffect(() => {
    if (!sitesQuery.data) {
      return;
    }
    const stored = sessionStorage.getItem(SITE_KEY);
    const match = sitesQuery.data.find((site) => site.id === stored);
    const next = match?.id ?? sitesQuery.data[0]?.id ?? null;
    setSiteIdState(next);
    if (next) {
      sessionStorage.setItem(SITE_KEY, next);
    } else {
      sessionStorage.removeItem(SITE_KEY);
    }
  }, [sitesQuery.data]);

  const value = useMemo<SiteContextValue>(() => {
    const sites = sitesQuery.data ?? [];
    return {
      sites,
      site: sites.find((site) => site.id === siteId) ?? null,
      siteId,
      loading: sitesQuery.isPending,
      error: sitesQuery.error,
      setSiteId: (id: string, options?: { navigate?: boolean }) => {
        sessionStorage.setItem(SITE_KEY, id);
        setSiteIdState(id);
        if (options?.navigate !== false) {
          navigate('/facility');
        }
      },
    };
  }, [navigate, siteId, sitesQuery.data, sitesQuery.error, sitesQuery.isPending]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSites(): SiteContextValue {
  const value = useContext(SiteContext);
  if (!value) {
    throw new Error('useSites must be used inside SiteProvider');
  }
  return value;
}
