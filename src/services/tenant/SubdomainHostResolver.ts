import { OrganizationTenant } from '../../types/capabilities';

export class SubdomainHostResolver {
  private static RESERVED_SUBDOMAINS = new Set([
    'www', 'app', 'admin', 'api', 'mail', 'staging', 'dev', 'localhost', 'studyfreeforum'
  ]);

  /**
   * Parses the hostname and returns the subdomain if it exists.
   */
  public static getSubdomain(hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''): string | null {
    if (!hostname) return null;

    // Support query parameter fallback (e.g. ?subdomain=futureleaders)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const querySub = urlParams.get('subdomain');
      if (querySub) return querySub.toLowerCase();
    }

    const parts = hostname.toLowerCase().split('.');

    // IP address or simple localhost
    if (parts.length <= 1 || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return null;
    }

    // e.g. futureleaders.localhost
    if (parts.length === 2 && parts[1] === 'localhost') {
      const sub = parts[0];
      if (this.RESERVED_SUBDOMAINS.has(sub)) return null;
      return sub;
    }

    // Vercel preview/deployment hosts look like
    // project-hash-team.vercel.app — the first label is the project name, not
    // a tenant, so treating it as one sent every preview visit hunting for a
    // tenant that cannot exist and filled the logs with 404s.
    if (hostname.endsWith('.vercel.app')) return null;

    // e.g. futureleaders.studyfreeforum.com
    if (parts.length >= 3) {
      const sub = parts[0];
      if (this.RESERVED_SUBDOMAINS.has(sub)) return null;
      return sub;
    }

    return null;
  }

  /**
   * Resolves the tenant from the host by fetching from the backend API.
   * Caches the result in sessionStorage.
   */
  public static async resolveTenantFromHost(): Promise<OrganizationTenant | null> {
    const subdomain = this.getSubdomain();
    if (!subdomain) return null;

    // Check cache
    const cacheKey = `tenant_config_${subdomain}`;
    if (typeof sessionStorage !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached) as OrganizationTenant;
        } catch (e) {
          sessionStorage.removeItem(cacheKey);
        }
      }
    }

    try {
      const response = await fetch(`/api/tenant/config?subdomain=${encodeURIComponent(subdomain)}`);
      if (!response.ok) {
        console.warn('Tenant config fetch failed:', response.statusText);
        return null;
      }

      const data = await response.json();
      if (data.success && data.tenant) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(data.tenant));
        }
        return data.tenant as OrganizationTenant;
      }
    } catch (e) {
      console.error('Error resolving tenant from host:', e);
    }

    return null;
  }
}
