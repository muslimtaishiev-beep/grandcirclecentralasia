import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import { TenantSubscription, TenantUsageMetrics, BillingInvoice, SubscriptionTierId } from '../../../types/billing';
import { PLAN_TIER_DEFINITIONS } from '../../../shared/plans';
import { tierLimitEnforcer } from '../../../services/billing/TierLimitEnforcer';
import { usageMeteringService } from '../../../services/billing/UsageMeteringService';
import PlanComparisonTable from './components/PlanComparisonTable';
import ResourceUsageMetrics from './components/ResourceUsageMetrics';
import InvoiceHistoryTable from './components/InvoiceHistoryTable';
import PaymentMethodConfigModal from './components/PaymentMethodConfigModal';

export default function SubscriptionBillingDashboard() {
  const { orgId } = useParams();
  const [sub, setSub] = useState<TenantSubscription | null>(null);
  const [usage, setUsage] = useState<TenantUsageMetrics | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedUpgrade, setSelectedUpgrade] = useState<{tier: SubscriptionTierId, interval: 'month'|'year'} | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!orgId) return;
      setLoading(true);
      try {
      // MOCK FETCH - In real app, fetch from Firestore
      const tier = await tierLimitEnforcer.getTenantTier(orgId);
      const metrics = await usageMeteringService.calculateRealTimeUsage(orgId);
      
      setSub({
        tenantId: orgId,
        tierId: tier,
        status: 'active',
        billingInterval: 'month',
        currentPeriodStart: Date.now() - 15 * 86400000, // 15 days ago
        currentPeriodEnd: Date.now() + 15 * 86400000,
        cancelAtPeriodEnd: false,
        paymentGateway: 'stripe'
      });
      
      setUsage(metrics);
      setInvoices([
        {
          id: 'inv_1',
          tenantId: orgId,
          invoiceNumber: 'INV-2026-0089',
          amount: 49.00,
          currency: 'USD',
          status: 'paid',
          tierId: 'starter',
          billingInterval: 'month',
          createdAt: Date.now() - 15 * 86400000,
          paidAt: Date.now() - 15 * 86400000,
          pdfInvoiceUrl: 'https://example.com/invoice.pdf'
        }
      ]);
      } catch (e) {
        // Сбой одного из расчётов не должен оставлять вечный спиннер.
        console.warn('Не удалось загрузить биллинг:', e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [orgId]);

  if (loading || !sub || !usage) {
    return <div className="p-8 text-center text-[var(--text-muted)] animate-pulse">Загрузка данных биллинга...</div>;
  }

  const handleUpgradeIntent = (tierId: SubscriptionTierId, interval: 'month' | 'year') => {
    setSelectedUpgrade({ tier: tierId, interval });
    setPaymentModalOpen(true);
  };

  const limits = PLAN_TIER_DEFINITIONS[sub.tierId];
  const daysLeft = Math.ceil((sub.currentPeriodEnd - Date.now()) / 86400000);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-emerald-500" /> Тарифы и оплата
          </h1>
          <p className="text-[var(--text-muted)] mt-1 font-medium">
            Управляйте подпиской, контролируйте лимиты и скачивайте счета.
          </p>
        </div>
        <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] px-6 py-4 rounded-2xl flex items-center gap-6 shadow-sm">
          <div>
            <p className="text-xs uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1">Текущий план</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold capitalize">{sub.tierId}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {sub.status}
              </span>
            </div>
          </div>
          <div className="h-10 w-px bg-[var(--border-color)]"></div>
          <div>
            <p className="text-xs uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1">Осталось дней</p>
            <span className="text-xl font-bold">{daysLeft}</span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Использование ресурсов</h2>
        <ResourceUsageMetrics usage={usage} limits={limits} />
      </div>

      <div className="pt-8">
        <h2 className="text-xl font-bold mb-4 text-center">Выберите подходящий тариф</h2>
        <PlanComparisonTable currentTierId={sub.tierId} onUpgrade={handleUpgradeIntent} />
      </div>

      <div className="pt-8">
        <h2 className="text-xl font-bold mb-4">История платежей</h2>
        <InvoiceHistoryTable invoices={invoices} />
      </div>

      {selectedUpgrade && (
        <PaymentMethodConfigModal 
          isOpen={paymentModalOpen} 
          onClose={() => setPaymentModalOpen(false)} 
          tenantId={orgId!} 
          tierId={selectedUpgrade.tier} 
          interval={selectedUpgrade.interval} 
        />
      )}
    </div>
  );
}
