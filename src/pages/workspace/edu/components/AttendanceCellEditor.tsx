import React, { useState } from 'react';
import { AttendanceStatus } from '../../../../types/edu';

interface Props {
  initialStatus?: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
  disabled?: boolean;
}

const statusMap: Record<AttendanceStatus, { label: string; color: string }> = {
  present: { label: 'П', color: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' },
  absent_unexcused: { label: 'Н', color: 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200' },
  absent_excused: { label: 'Ув', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' },
  late: { label: 'Оп', color: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' },
};

export default function AttendanceCellEditor({ initialStatus, onChange, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const current = initialStatus ? statusMap[initialStatus] : null;

  const handleSelect = (status: AttendanceStatus) => {
    onChange(status);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button 
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border transition-colors ${
          current ? current.color : 'bg-[var(--bg-surface)] border-[var(--border-color)] hover:border-[var(--accent)] text-[var(--text-muted)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {current ? current.label : '-'}
      </button>

      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-[var(--bg-panel)] shadow-xl border border-[var(--border-color)] rounded-xl p-1.5 flex gap-1 animate-in fade-in zoom-in-95 duration-100">
            {(Object.keys(statusMap) as AttendanceStatus[]).map(status => (
              <button
                key={status}
                onClick={() => handleSelect(status)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border transition-colors ${statusMap[status].color}`}
              >
                {statusMap[status].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
