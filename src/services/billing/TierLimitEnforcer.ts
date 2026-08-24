import { PlanLimits, SubscriptionTierId } from '../../types/billing';
import { usageMeteringService } from './UsageMeteringService';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const PLAN_TIER_DEFINITIONS: Record<SubscriptionTierId, PlanLimits> = {
  starter: {
    maxStaffMembers: 10,
    maxActiveStudents: 500,
    maxCustomFunctions: 5,
    maxLandingPages: 1,
    storageLimitMb: 5120,
    hasWebRtcVideoCalls: false,
    hasAiProctoring: false,
    hasCustomDomain: false,
    hasAuditLogsExport: false,
  },
  business: {
    maxStaffMembers: 50,
    maxActiveStudents: 3000,
    maxCustomFunctions: 25,
    maxLandingPages: 5,
    storageLimitMb: 51200,
    hasWebRtcVideoCalls: true,
    hasAiProctoring: true,
    hasCustomDomain: false,
    hasAuditLogsExport: true,
  },
  enterprise: {
    maxStaffMembers: Infinity,
    maxActiveStudents: Infinity,
    maxCustomFunctions: Infinity,
    maxLandingPages: Infinity,
    storageLimitMb: 512000,
    hasWebRtcVideoCalls: true,
    hasAiProctoring: true,
    hasCustomDomain: true,
    hasAuditLogsExport: true,
  }
};

export class QuotaExceededError extends Error {
  constructor(public resource: keyof PlanLimits, message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

class TierLimitEnforcer {
  async getTenantTier(tenantId: string): Promise<SubscriptionTierId> {
    const subRef = doc(db, 'tenants', tenantId, 'billing', 'subscription');
    const snap = await getDoc(subRef);
    if (snap.exists() && snap.data().tierId) {
      return snap.data().tierId as SubscriptionTierId;
    }
    return 'starter'; // Default fallback
  }

  async canAddStaffMember(tenantId: string): Promise<{ allowed: boolean; current: number; max: number }> {
    const tierId = await this.getTenantTier(tenantId);
    const limits = PLAN_TIER_DEFINITIONS[tierId];
    const usage = await usageMeteringService.getTenantUsage(tenantId);
    
    return {
      allowed: usage.currentStaffCount < limits.maxStaffMembers,
      current: usage.currentStaffCount,
      max: limits.maxStaffMembers
    };
  }

  async canCreateCustomFunction(tenantId: string): Promise<{ allowed: boolean; current: number; max: number }> {
    const tierId = await this.getTenantTier(tenantId);
    const limits = PLAN_TIER_DEFINITIONS[tierId];
    const usage = await usageMeteringService.getTenantUsage(tenantId);
    
    return {
      allowed: usage.currentCustomFunctionsCount < limits.maxCustomFunctions,
      current: usage.currentCustomFunctionsCount,
      max: limits.maxCustomFunctions
    };
  }

  async canAccessFeature(tenantId: string, feature: keyof PlanLimits): Promise<{ allowed: boolean; reason?: string }> {
    const tierId = await this.getTenantTier(tenantId);
    const limits = PLAN_TIER_DEFINITIONS[tierId];
    
    const allowed = Boolean(limits[feature]);
    return {
      allowed,
      reason: allowed ? undefined : `Feature ${feature} is not available on the ${tierId} plan.`
    };
  }

  async assertResourceAvailable(tenantId: string, resource: keyof PlanLimits): Promise<void> {
    const tierId = await this.getTenantTier(tenantId);
    const limits = PLAN_TIER_DEFINITIONS[tierId];
    const usage = await usageMeteringService.getTenantUsage(tenantId);

    switch (resource) {
      case 'maxStaffMembers':
        if (usage.currentStaffCount >= limits.maxStaffMembers) {
          throw new QuotaExceededError(resource, `Staff member limit (${limits.maxStaffMembers}) exceeded.`);
        }
        break;
      case 'maxActiveStudents':
        if (usage.currentActiveStudents >= limits.maxActiveStudents) {
          throw new QuotaExceededError(resource, `Active students limit (${limits.maxActiveStudents}) exceeded.`);
        }
        break;
      case 'maxCustomFunctions':
        if (usage.currentCustomFunctionsCount >= limits.maxCustomFunctions) {
          throw new QuotaExceededError(resource, `Custom functions limit (${limits.maxCustomFunctions}) exceeded.`);
        }
        break;
      case 'hasWebRtcVideoCalls':
        if (!limits.hasWebRtcVideoCalls) {
          throw new QuotaExceededError(resource, `WebRTC Video Calls are not available on your current plan.`);
        }
        break;
      // Implement others as needed
      default:
        break;
    }
  }
}

export const tierLimitEnforcer = new TierLimitEnforcer();
