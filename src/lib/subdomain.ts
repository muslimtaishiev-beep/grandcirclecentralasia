import { SubdomainHostResolver } from '../services/tenant/SubdomainHostResolver';

export function getSubdomain(hostname?: string): string | null {
  return SubdomainHostResolver.getSubdomain(hostname);
}

// Keeping this around strictly for legacy synchronous fallbacks, but TenantContext should be used where possible.
export function getTenantIdFromSubdomain(hostname?: string): string {
  // If we can't do it async, we can check sessionStorage cache
  const sub = SubdomainHostResolver.getSubdomain(hostname);
  if (!sub) return 'org_future_leaders';
  
  if (typeof sessionStorage !== 'undefined') {
    const cached = sessionStorage.getItem(`tenant_config_${sub}`);
    if (cached) {
      try {
        const tenant = JSON.parse(cached);
        return tenant.id;
      } catch (e) {}
    }
  }
  return 'org_future_leaders'; // Fallback
}
