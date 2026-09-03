import type { SubscriptionTierId } from '../../types/billing';
import { PLAN_TIER_DEFINITIONS } from '../../shared/plans';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export { PLAN_TIER_DEFINITIONS };

/**
 * Тариф организации — для карточки подписки.
 *
 * Квоты (лимиты сотрудников, функций и т.п.) здесь раньше «проверялись»
 * методами, которые никто не вызывал; их убрали, чтобы не создавать
 * видимость контроля, которого нет. Когда лимиты понадобятся — они должны
 * проверяться на сервере при создании, а не в браузере.
 */
class TierLimitEnforcer {
  async getTenantTier(tenantId: string): Promise<SubscriptionTierId> {
    const subRef = doc(db, 'tenants', tenantId, 'billing', 'subscription');
    const snap = await getDoc(subRef);
    if (snap.exists() && snap.data().tierId) {
      return snap.data().tierId as SubscriptionTierId;
    }
    const tenantSnap = await getDoc(doc(db, 'tenants', tenantId));
    const tierId = tenantSnap.exists() ? tenantSnap.data().tierId : undefined;
    if (tierId && tierId in PLAN_TIER_DEFINITIONS) return tierId as SubscriptionTierId;
    return 'starter';
  }
}

export const tierLimitEnforcer = new TierLimitEnforcer();
