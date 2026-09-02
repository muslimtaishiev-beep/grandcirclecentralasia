import { SubdomainHostResolver } from '../services/tenant/SubdomainHostResolver';

export function getSubdomain(hostname?: string): string | null {
  return SubdomainHostResolver.getSubdomain(hostname);
}

// getTenantIdFromSubdomain удалена: она возвращала org_future_leaders для
// любого неизвестного субдомена, и чужая организация молча получала данные
// Академии. Живых потребителей у неё не было; резолюция — через
// /api/tenant/resolve (src/lib/resolveTenant.ts) или TenantContext.
