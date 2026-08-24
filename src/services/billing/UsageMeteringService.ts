import { db } from '../../lib/firebase';
import { doc, getDoc, collection, getCountFromServer } from 'firebase/firestore';
import { TenantUsageMetrics } from '../../types/billing';

class UsageMeteringService {
  async getTenantUsage(tenantId: string): Promise<TenantUsageMetrics> {
    // In a real application, this would either be aggregated via Cloud Functions
    // or queried efficiently. Here we simulate the counts.
    const usageRef = doc(db, 'tenants', tenantId, 'billing', 'usage');
    const usageDoc = await getDoc(usageRef);
    
    if (usageDoc.exists()) {
      return usageDoc.data() as TenantUsageMetrics;
    }

    // Fallback/Initial state if no aggregated document exists
    // We could do getCountFromServer for exact numbers if needed.
    return {
      currentStaffCount: 1, // Default owner
      currentActiveStudents: 0,
      currentCustomFunctionsCount: 0,
      currentLandingPagesCount: 0,
      currentStorageUsedMb: 0,
      lastCalculatedAt: Date.now(),
    };
  }

  async calculateRealTimeUsage(tenantId: string): Promise<TenantUsageMetrics> {
    const staffQuery = collection(db, 'tenants', tenantId, 'members');
    const staffCount = (await getCountFromServer(staffQuery)).data().count;

    const studentsQuery = collection(db, 'tenants', tenantId, 'students');
    const studentsCount = (await getCountFromServer(studentsQuery)).data().count;

    return {
      currentStaffCount: staffCount,
      currentActiveStudents: studentsCount,
      currentCustomFunctionsCount: 0,
      currentLandingPagesCount: 1,
      currentStorageUsedMb: 120, // Example mocked storage
      lastCalculatedAt: Date.now()
    };
  }
}

export const usageMeteringService = new UsageMeteringService();
