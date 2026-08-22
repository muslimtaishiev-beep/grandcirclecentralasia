/**
 * Utility to extract and resolve tenant subdomains dynamically.
 * Examples:
 *  - futureleaders.studyfreeforum.com -> 'futureleaders' -> 'org_future_leaders'
 *  - org-future-leaders.studyfreeforum.com -> 'org_future_leaders'
 *  - futureleaders.localhost -> 'futureleaders' -> 'org_future_leaders'
 */

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'app',
  'admin',
  'api',
  'mail',
  'staging',
  'dev',
  'localhost',
  'studyfreeforum'
]);

const KNOWN_ALIASES: Record<string, string> = {
  'futureleaders': 'org_future_leaders',
  'future-leaders': 'org_future_leaders',
  'academy': 'org_future_leaders',
  'grandcircle': 'org_future_leaders',
  'org_future_leaders': 'org_future_leaders',
};

export function getSubdomain(hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''): string | null {
  if (!hostname) return null;

  const parts = hostname.toLowerCase().split('.');

  if (parts.length <= 1 || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  if (parts.length === 2 && parts[1] === 'localhost') {
    const sub = parts[0];
    if (RESERVED_SUBDOMAINS.has(sub)) return null;
    return sub;
  }

  if (parts.length >= 3) {
    const sub = parts[0];
    if (RESERVED_SUBDOMAINS.has(sub)) return null;
    return sub;
  }

  return null;
}

export function getTenantIdFromSubdomain(hostname?: string): string {
  const sub = getSubdomain(hostname);
  if (!sub) return 'org_future_leaders';
  return KNOWN_ALIASES[sub] || sub;
}
