import type { PlanLimits, SubscriptionTierId } from "../types/billing";

/** Что входит в тариф — для сравнения планов и карточки подписки. */
export const PLAN_TIER_DEFINITIONS: Record<SubscriptionTierId, PlanLimits> = {
  starter: {
    maxStaffMembers: 10, maxActiveStudents: 500, maxCustomFunctions: 5, maxLandingPages: 1,
    storageLimitMb: 5120, hasWebRtcVideoCalls: false, hasAiProctoring: false, hasCustomDomain: false, hasAuditLogsExport: false,
  },
  business: {
    maxStaffMembers: 50, maxActiveStudents: 3000, maxCustomFunctions: 25, maxLandingPages: 5,
    storageLimitMb: 51200, hasWebRtcVideoCalls: true, hasAiProctoring: true, hasCustomDomain: false, hasAuditLogsExport: true,
  },
  enterprise: {
    maxStaffMembers: Infinity, maxActiveStudents: Infinity, maxCustomFunctions: Infinity, maxLandingPages: Infinity,
    storageLimitMb: 512000, hasWebRtcVideoCalls: true, hasAiProctoring: true, hasCustomDomain: true, hasAuditLogsExport: true,
  },
};
