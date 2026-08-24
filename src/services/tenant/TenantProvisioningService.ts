import { OrganizationTenant, SystemFeatureModule } from '../../types/capabilities';
import { db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export class TenantProvisioningService {
  /**
   * Provisions a new tenant organization in Firestore and sets up default CRM pipelines.
   */
  public static async provisionNewTenant(
    name: string,
    subdomain: string,
    ownerEmail: string,
    tierId: 'starter' | 'business' | 'enterprise',
    enabledModules: SystemFeatureModule[]
  ): Promise<OrganizationTenant> {
    const tenantId = `org_${subdomain.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    const newTenant: OrganizationTenant = {
      id: tenantId,
      name,
      subdomain: subdomain.toLowerCase(),
      tierId,
      status: 'active',
      enabledModules,
      ownerEmail,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      // Create Tenant Document
      await setDoc(doc(db, 'tenants', tenantId), newTenant);
      
      // Create Membership for Owner
      const memberId = `${tenantId}_${ownerEmail.replace(/[@.]/g, '_')}`;
      await setDoc(doc(db, 'memberships', memberId), {
        tenantId,
        email: ownerEmail,
        role: 'org:owner',
        createdAt: Date.now(),
      });

      // (Optional) Setup default CRM pipelines here if MODULE_CRM_PIPELINES is enabled
      if (enabledModules.includes('MODULE_CRM_PIPELINES')) {
        await setDoc(doc(db, `tenants/${tenantId}/crm_pipelines`, 'default_pipeline'), {
          name: 'Воронка продаж',
          stages: ['Новый лид', 'В работе', 'Принимает решение', 'Успешно реализовано', 'Закрыто и не реализовано']
        });
      }
      
      return newTenant;
    } catch (e: any) {
      console.error('Failed to provision tenant', e);
      throw new Error(`Provisioning failed: ${e.message}`);
    }
  }
}
