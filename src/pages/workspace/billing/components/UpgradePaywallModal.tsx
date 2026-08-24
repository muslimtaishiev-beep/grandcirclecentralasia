import React from 'react';
import { AlertTriangle, X, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  tenantId: string;
}

export default function UpgradePaywallModal({ isOpen, onClose, title, description, tenantId }: Props) {
  const navigate = useNavigate();
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--bg-panel)] rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-[var(--border-color)] animate-in zoom-in-95 duration-200">
        <div className="relative p-8 text-center">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-20 h-20 mx-auto bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10" />
          </div>
          
          <h2 className="text-2xl font-bold mb-4">{title}</h2>
          <p className="text-[var(--text-muted)] font-medium leading-relaxed mb-8">
            {description}
          </p>
          
          <button 
            onClick={() => {
              onClose();
              navigate(`/workspace/${tenantId}/billing`);
            }}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-xl transition shadow-xl shadow-emerald-500/20"
          >
            <Zap className="w-5 h-5 fill-current" /> Разблокировать лимиты
          </button>
          <button 
            onClick={onClose}
            className="w-full mt-4 py-3 font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
          >
            Не сейчас
          </button>
        </div>
      </div>
    </div>
  );
}
