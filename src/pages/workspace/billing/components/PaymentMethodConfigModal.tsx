import React, { useState } from 'react';
import { X, CreditCard, Building2, Smartphone } from 'lucide-react';
import { paymentGatewayAdapter } from '../../../../services/billing/PaymentGatewayAdapter';
import { SubscriptionTierId } from '../../../../types/billing';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tierId: SubscriptionTierId;
  interval: 'month' | 'year';
}

export default function PaymentMethodConfigModal({ isOpen, onClose, tenantId, tierId, interval }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  if (!isOpen) return null;

  const handleSelectGateway = async (gateway: 'stripe' | 'mbank' | 'kaspi') => {
    try {
      setLoading(true);
      setError(null);
      const res = await paymentGatewayAdapter.initiateSubscriptionCheckout({
        tenantId,
        tierId,
        interval,
        gateway,
        successUrl: window.location.origin + `/workspace/${tenantId}/billing?success=true`,
        cancelUrl: window.location.origin + `/workspace/${tenantId}/billing?canceled=true`
      });

      if (res.error) throw new Error(res.error);
      
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else if (res.qrCodeUrl) {
        // In reality, show a QR modal step, but redirecting to an MBANK mock page for now
        window.location.href = res.qrCodeUrl;
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      // Спиннер гаснет всегда: если шлюз не вернул ни ссылки, ни ошибки,
      // кнопка раньше оставалась «крутиться» навечно.
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--bg-panel)] rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-[var(--border-color)] animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-bold">Выберите способ оплаты</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {error && <div className="p-4 bg-rose-500/10 text-rose-500 rounded-xl text-sm font-bold">{error}</div>}
          
          <button 
            disabled={loading}
            onClick={() => handleSelectGateway('stripe')}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-emerald-500 transition group text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 group-hover:text-emerald-500 group-hover:bg-emerald-500/10 transition">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-lg">Банковская карта</h4>
                <p className="text-sm text-[var(--text-muted)]">Visa, Mastercard, Maestro (Stripe)</p>
              </div>
            </div>
          </button>

          <button 
            disabled={loading}
            onClick={() => handleSelectGateway('kaspi')}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-emerald-500 transition group text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#F14635]/10 rounded-xl flex items-center justify-center text-[#F14635] transition">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-lg">Kaspi Pay</h4>
                <p className="text-sm text-[var(--text-muted)]">Удаленная оплата по счету (Казахстан)</p>
              </div>
            </div>
          </button>

          <button 
            disabled={loading}
            onClick={() => handleSelectGateway('mbank')}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-emerald-500 transition group text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500 transition">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-lg">MBANK QR</h4>
                <p className="text-sm text-[var(--text-muted)]">Оплата через приложение MBANK (Кыргызстан)</p>
              </div>
            </div>
          </button>
          
          {loading && (
            <div className="text-center text-sm font-bold text-[var(--text-muted)] animate-pulse pt-4">
              Подготовка безопасного шлюза...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
