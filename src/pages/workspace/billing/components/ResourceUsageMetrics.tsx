import React from 'react';
import { TenantUsageMetrics, PlanLimits } from '../../../../types/billing';

interface Props {
  usage: TenantUsageMetrics;
  limits: PlanLimits;
}

export default function ResourceUsageMetrics({ usage, limits }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <UsageBar 
        title="Сотрудники" 
        current={usage.currentStaffCount} 
        max={limits.maxStaffMembers} 
      />
      <UsageBar 
        title="Студенты" 
        current={usage.currentActiveStudents} 
        max={limits.maxActiveStudents} 
      />
      <UsageBar 
        title="Дисковое пространство (MB)" 
        current={usage.currentStorageUsedMb} 
        max={limits.storageLimitMb} 
        formatValue={(val) => `${(val).toFixed(1)}`}
      />
      <UsageBar 
        title="Сайты / Лендинги" 
        current={usage.currentLandingPagesCount} 
        max={limits.maxLandingPages} 
      />
    </div>
  );
}

function UsageBar({ title, current, max, formatValue }: { title: string; current: number; max: number; formatValue?: (v: number) => string }) {
  const isInfinity = max === Infinity;
  const percent = isInfinity ? 0 : Math.min(100, (current / max) * 100);
  
  let colorClass = 'bg-emerald-500';
  if (!isInfinity) {
    if (percent >= 100) colorClass = 'bg-rose-500';
    else if (percent >= 85) colorClass = 'bg-amber-500';
  }

  const displayCurrent = formatValue ? formatValue(current) : current;
  const displayMax = isInfinity ? 'Безлимит' : (formatValue ? formatValue(max) : max);

  return (
    <div className="bg-[var(--bg-panel)] p-5 rounded-xl border border-[var(--border-color)]">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-bold text-sm">{title}</h4>
        <span className="text-xs font-medium text-[var(--text-muted)]">
          {displayCurrent} / {displayMax}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ease-out ${isInfinity ? 'bg-emerald-500/50 w-full' : colorClass}`}
          style={{ width: isInfinity ? '100%' : `${percent}%` }}
        ></div>
      </div>
      {!isInfinity && percent >= 85 && percent < 100 && (
        <p className="text-[10px] text-amber-500 mt-2 font-bold uppercase tracking-wider">Лимит почти исчерпан</p>
      )}
      {!isInfinity && percent >= 100 && (
        <p className="text-[10px] text-rose-500 mt-2 font-bold uppercase tracking-wider">Лимит превышен</p>
      )}
    </div>
  );
}
