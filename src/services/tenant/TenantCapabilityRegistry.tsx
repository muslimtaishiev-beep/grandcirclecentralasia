import React from 'react';
import { OrganizationTenant, SystemFeatureModule } from '../../types/capabilities';
import { useTenant } from '../../context/TenantContext';

export class TenantCapabilityRegistry {
  public static isFeatureEnabled(tenant: OrganizationTenant | null, module: SystemFeatureModule): boolean {
    if (!tenant) return false;
    return tenant.enabledModules.includes(module);
  }

  public static assertFeatureEnabled(tenant: OrganizationTenant | null, module: SystemFeatureModule): void {
    if (!this.isFeatureEnabled(tenant, module)) {
      throw new Error(`Permission Denied: Module ${module} is not enabled for tenant ${tenant?.name || 'Unknown'}`);
    }
  }
}

interface FeatureGateProps {
  module: SystemFeatureModule;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ module, children, fallback = null }) => {
  const { tenant, loading } = useTenant();

  if (loading) return null; // Or a spinner if preferred

  if (TenantCapabilityRegistry.isFeatureEnabled(tenant, module)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};
