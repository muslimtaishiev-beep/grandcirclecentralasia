import React from 'react';
import { X, CreditCard } from 'lucide-react';
import { SubscriptionTierId } from '../../../../types/billing';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tierId: SubscriptionTierId;
  interval: 'month' | 'year';
}

/**
 * Оплата пока не подключена — и окно говорит об этом прямо.
 *
 * Раньше здесь были три «шлюза», которые вели на выдуманные адреса
 * (cs_test_mock123, mbank.kg/mock-qr-code, kaspi.kz/pay/mock_invoice).
 * Владелец нажимал «Банковская карта» и попадал в никуда. Пока настоящей
 * интеграции нет, честнее сказать это словами, чем изображать оплату.
 */
export default function PaymentMethodConfigModal({ isOpen, onClose, tierId, interval }: Props) {
  if (!isOpen) return null;

  const planLabel: Record<SubscriptionTierId, string> = {
    starter: 'Стартовый', business: 'Бизнес', enterprise: 'Корпоративный',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--bg-panel)] rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-[var(--border-color)]">
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-bold">Оплата тарифа</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Закрыть">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl flex items-center justify-center text-[var(--text-muted)] shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold">Онлайн-оплата пока не подключена</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Вы выбрали тариф «{planLabel[tierId] || tierId}»,
                оплата {interval === 'year' ? 'за год' : 'помесячно'}.
                Чтобы перейти на него, напишите администратору платформы — счёт выставят вручную.
              </p>
            </div>
          </div>

          <button onClick={onClose}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition">
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
