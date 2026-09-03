import React, { useState } from 'react';
import { SubscriptionTierId } from '../../../../types/billing';
import { PLAN_TIER_DEFINITIONS } from '../../../../shared/plans';
import { Check, X } from 'lucide-react';

interface Props {
  currentTierId: SubscriptionTierId;
  onUpgrade: (tierId: SubscriptionTierId, interval: 'month' | 'year') => void;
}

const PRICING = {
  starter: { month: 49, year: 470 },
  business: { month: 149, year: 1430 },
  enterprise: { month: 399, year: 3830 }
};

export default function PlanComparisonTable({ currentTierId, onUpgrade }: Props) {
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  const plans = [
    { id: 'starter' as const, name: 'Стартовый' },
    { id: 'business' as const, name: 'Бизнес' },
    { id: 'enterprise' as const, name: 'Корпоративный' }
  ];

  return (
    <div className="w-full">
      <div className="flex justify-center mb-8">
        <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-xl inline-flex items-center">
          <button 
            onClick={() => setInterval('month')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              interval === 'month' ? 'bg-white dark:bg-slate-600 shadow-sm text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Ежемесячно
          </button>
          <button 
            onClick={() => setInterval('year')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
              interval === 'year' ? 'bg-white dark:bg-slate-600 shadow-sm text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Ежегодно <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded-full uppercase">-20%</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const limits = PLAN_TIER_DEFINITIONS[plan.id];
          const price = PRICING[plan.id][interval];
          const isCurrent = currentTierId === plan.id;
          
          return (
            <div key={plan.id} className={`bg-[var(--bg-panel)] rounded-2xl p-6 border-2 transition-all ${isCurrent ? 'border-emerald-500 shadow-xl shadow-emerald-500/10' : 'border-[var(--border-color)] hover:border-slate-400'}`}>
              {isCurrent && <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-2">Текущий план</div>}
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-4xl font-extrabold">${price}</span>
                <span className="text-[var(--text-muted)] font-medium mb-1">/{interval === 'month' ? 'мес' : 'год'}</span>
              </div>
              
              <button 
                onClick={() => onUpgrade(plan.id, interval)}
                disabled={isCurrent}
                className={`w-full py-3 rounded-xl font-bold mb-8 transition ${
                  isCurrent 
                    ? 'bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                }`}
              >
                {isCurrent ? 'Ваш текущий тариф' : `Перейти на ${plan.name}`}
              </button>

              <div className="space-y-4">
                <FeatureItem label={`Сотрудников: ${limits.maxStaffMembers === Infinity ? 'Безлимит' : limits.maxStaffMembers}`} />
                <FeatureItem label={`Студентов: ${limits.maxActiveStudents === Infinity ? 'Безлимит' : limits.maxActiveStudents}`} />
                <FeatureItem label={`Своих функций: ${limits.maxCustomFunctions === Infinity ? 'Безлимит' : limits.maxCustomFunctions}`} />
                <FeatureItem label={`Сайтов: ${limits.maxLandingPages === Infinity ? 'Безлимит' : limits.maxLandingPages}`} />
                <FeatureItem label={`Диск: ${limits.storageLimitMb >= 512000 ? '500 GB' : limits.storageLimitMb / 1024 + ' GB'}`} />
                
                <div className="h-px bg-[var(--border-color)] my-4"></div>
                
                <FeatureItem label="WebRTC Видеозвонки" included={limits.hasWebRtcVideoCalls} />
                <FeatureItem label="AI Прокторинг" included={limits.hasAiProctoring} />
                <FeatureItem label="Кастомный Домен" included={limits.hasCustomDomain} />
                <FeatureItem label="Экспорт Аудит-логов" included={limits.hasAuditLogsExport} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeatureItem({ label, included = true }: { label: string; included?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {included ? (
        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
          <Check className="w-3.5 h-3.5" />
        </div>
      ) : (
        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
          <X className="w-3.5 h-3.5" />
        </div>
      )}
      <span className={included ? 'text-[var(--text-main)] font-medium' : 'text-[var(--text-muted)] line-through opacity-70'}>
        {label}
      </span>
    </div>
  );
}
