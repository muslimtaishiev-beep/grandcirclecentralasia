export type SubscriptionTierId = 'starter' | 'business' | 'enterprise';

export interface PlanLimits {
  maxStaffMembers: number;
  maxActiveStudents: number;
  maxCustomFunctions: number;
  maxLandingPages: number;
  storageLimitMb: number;
  hasWebRtcVideoCalls: boolean;
  hasAiProctoring: boolean;
  hasCustomDomain: boolean;
  hasAuditLogsExport: boolean;
}

export interface TenantSubscription {
  tenantId: string;
  tierId: SubscriptionTierId;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
  billingInterval: 'month' | 'year';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  paymentGateway: 'stripe' | 'mbank' | 'kaspi' | 'manual_invoice';
  lastInvoiceId?: string;
  customDiscountPercent?: number;
}

export interface TenantUsageMetrics {
  currentStaffCount: number;
  currentActiveStudents: number;
  currentCustomFunctionsCount: number;
  currentLandingPagesCount: number;
  currentStorageUsedMb: number;
  lastCalculatedAt: number;
}

export interface BillingInvoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  amount: number;
  currency: 'USD' | 'KGS' | 'KZT';
  status: 'paid' | 'pending' | 'failed';
  tierId: SubscriptionTierId;
  billingInterval: 'month' | 'year';
  createdAt: number;
  paidAt?: number;
  pdfInvoiceUrl?: string;
}
