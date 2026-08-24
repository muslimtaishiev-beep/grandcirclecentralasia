import { collection, query, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tenant } from '../types/firestore';

export interface PlatformMetrics {
  mrr: number;
  arr: number;
  totalTenants: number;
  planBreakdown: { starter: number; business: number; enterprise: number };
  activeStudents: number;
  activeStaff: number;
}

export async function fetchAllTenants(): Promise<Tenant[]> {
  const q = query(collection(db, 'tenants'));
  const snap = await getDocs(q);
  const tenants: Tenant[] = [];
  snap.forEach(doc => {
    tenants.push(doc.data() as Tenant);
  });
  return tenants;
}

export async function fetchPlatformMetrics(): Promise<PlatformMetrics> {
  // In a real prod environment, this would be an aggregation function in Cloud Functions.
  // For demo/prototype, we fetch and aggregate locally.
  const tenants = await fetchAllTenants();
  
  let totalStarter = 0;
  let totalBusiness = 0;
  let totalEnterprise = 0;

  tenants.forEach(t => {
    // Infer plan based on maxStudents limit (mock logic)
    if (t.settings.maxStudents <= 100) totalStarter++;
    else if (t.settings.maxStudents <= 500) totalBusiness++;
    else totalEnterprise++;
  });

  const mrr = (totalStarter * 49) + (totalBusiness * 149) + (totalEnterprise * 399);
  
  return {
    mrr,
    arr: mrr * 12,
    totalTenants: tenants.length,
    planBreakdown: {
      starter: totalStarter,
      business: totalBusiness,
      enterprise: totalEnterprise
    },
    activeStudents: tenants.length * 120, // Mocked active students per tenant avg
    activeStaff: tenants.length * 5       // Mocked staff per tenant avg
  };
}

export async function updateTenantPlan(tenantId: string, newMaxStudents: number) {
  const ref = doc(db, 'tenants', tenantId);
  await updateDoc(ref, {
    'settings.maxStudents': newMaxStudents
  });
}

export async function toggleTenantStatus(tenantId: string, newStatus: 'active' | 'suspended') {
  const ref = doc(db, 'tenants', tenantId);
  await updateDoc(ref, {
    status: newStatus
  });
}
