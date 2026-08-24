import React, { createContext, useContext, useEffect, useState } from 'react';
import { OrganizationTenant } from '../types/capabilities';
import { SubdomainHostResolver } from '../services/tenant/SubdomainHostResolver';
import { TenantCapabilityRegistry } from '../services/tenant/TenantCapabilityRegistry';

interface TenantContextProps {
  tenant: OrganizationTenant | null;
  loading: boolean;
  error: string | null;
  hasModule: (module: import('../types/capabilities').SystemFeatureModule) => boolean;
}

const TenantContext = createContext<TenantContextProps>({
  tenant: null,
  loading: true,
  error: null,
  hasModule: () => false,
});

export const useTenant = () => useContext(TenantContext);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<OrganizationTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initTenant = async () => {
      try {
        const resolvedTenant = await SubdomainHostResolver.resolveTenantFromHost();
        setTenant(resolvedTenant);
      } catch (err: any) {
        setError(err.message || 'Failed to resolve tenant');
      } finally {
        setLoading(false);
      }
    };
    initTenant();
  }, []);

  const hasModule = (module: import('../types/capabilities').SystemFeatureModule) => {
    return TenantCapabilityRegistry.isFeatureEnabled(tenant, module);
  };

  return (
    <TenantContext.Provider value={{ tenant, loading, error, hasModule }}>
      {children}
    </TenantContext.Provider>
  );
};
