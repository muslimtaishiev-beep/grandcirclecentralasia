import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { TenantLandingPage } from '../../types/siteBuilder';

export async function resolveTenantPage(
  subdomainOrId: string, 
  slug: string
): Promise<TenantLandingPage | null> {
  try {
    // landing_pages хранит tenantId в виде org_..., а сюда с субдомена
    // приходит голое имя («oxford») — запрос по сырой строке не совпадал
    // НИКОГДА, и публичные страницы по субдомену были сломаны с рождения.
    // Сначала резолвим имя в id.
    let tenantId = subdomainOrId;
    if (!tenantId.startsWith('org_')) {
      const { resolveTenantId } = await import('../../lib/resolveTenant');
      const resolved = await resolveTenantId(tenantId);
      if (!resolved) return null;
      tenantId = resolved.id;
    }

    const q = query(
      collection(db, 'landing_pages'),
      where('tenantId', '==', tenantId),
      where('slug', '==', slug),
      where('status', '==', 'published'),
      limit(1)
    );
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      return snap.docs[0].data() as TenantLandingPage;
    }
    
    return null;
  } catch (err) {
    console.error('Failed to resolve tenant page:', err);
    return null;
  }
}

export function getCurrentTenantContext(urlParamsSubdomain?: string) {
  const hostname = window.location.hostname;
  
  if (urlParamsSubdomain) {
    return urlParamsSubdomain;
  }

  // Example: "school.platform.com" -> "school"
  const parts = hostname.split('.');
  if (parts.length >= 3 && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return parts[0];
  }

  const urlParams = new URLSearchParams(window.location.search);
  const queryTenantId = urlParams.get('tenantId');
  if (queryTenantId) {
    return queryTenantId;
  }

  return null;
}
