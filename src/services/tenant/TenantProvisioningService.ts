import { auth } from '../../lib/firebase';

export interface ProvisionedTenant {
  tenantId: string;
  subdomain: string;
  ownerEmail: string;
  inviteEmailSent: boolean;
  inviteLink?: string;
  urls?: { site: string; workspace: string };
}

/**
 * Создание организации — через сервер (POST /api/superadmin/tenants).
 * Браузер больше не пишет tenants/memberships напрямую: сервер проверяет
 * занятость субдомена, создаёт владельца и его членство.
 */
export class TenantProvisioningService {
  public static async provisionNewTenant(
    name: string,
    subdomain: string,
    ownerEmail: string,
    tierId: 'starter' | 'business' | 'enterprise',
  ): Promise<ProvisionedTenant> {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    const res = await fetch('/api/superadmin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, subdomain, ownerEmail, tierId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.error || `Ошибка ${res.status}`);
    return data as ProvisionedTenant;
  }
}
