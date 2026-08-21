import React, { useState } from 'react';
import { Eye, EyeOff, Check, X, ShieldAlert, Lock } from 'lucide-react';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onPasswordChange?: (val: string, isValid: boolean) => void;
  showStrengthMeter?: boolean;
}

export function evaluatePasswordStrength(password: string) {
  const minLength = password.length >= 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const score = [minLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  const isValid = minLength && score >= 4;

  return { minLength, hasUpper, hasLower, hasNumber, hasSpecial, score, isValid };
}

export default function PasswordInput({
  value,
  onChange,
  onPasswordChange,
  showStrengthMeter = true,
  placeholder = "Введите пароль...",
  className = "",
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const strength = evaluatePasswordStrength(value || '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) onChange(e);
    if (onPasswordChange) {
      const s = evaluatePasswordStrength(e.target.value);
      onPasswordChange(e.target.value, s.isValid);
    }
  };

  return (
    <div className="space-y-2 w-full">
      <div className="relative">
        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          {...props}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full pl-9 pr-10 py-2 bg-[var(--bg-surface)] border ${
            value && !strength.isValid ? 'border-amber-500/50' : 'border-[var(--border-color)]'
          } rounded-xl text-sm text-[var(--text-main)] outline-hidden focus:border-[var(--accent)] transition ${className}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
          title={showPassword ? "Скрыть пароль" : "Показать пароль"}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {showStrengthMeter && value.length > 0 && (
        <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-color)] text-xs space-y-2">
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden flex gap-1">
              <div className={`h-full flex-1 transition-all ${strength.score >= 1 ? (strength.score >= 4 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-transparent'}`} />
              <div className={`h-full flex-1 transition-all ${strength.score >= 2 ? (strength.score >= 4 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-transparent'}`} />
              <div className={`h-full flex-1 transition-all ${strength.score >= 3 ? (strength.score >= 4 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-transparent'}`} />
              <div className={`h-full flex-1 transition-all ${strength.score >= 5 ? 'bg-emerald-500' : 'bg-transparent'}`} />
            </div>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              {strength.isValid ? 'Надёжный' : 'Слабый'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 text-[11px] text-[var(--text-muted)]">
            <div className={`flex items-center gap-1 ${strength.minLength ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
              {strength.minLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Мин. 12 символов
            </div>
            <div className={`flex items-center gap-1 ${strength.hasUpper ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
              {strength.hasUpper ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Прописные буквы (A-Z)
            </div>
            <div className={`flex items-center gap-1 ${strength.hasLower ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
              {strength.hasLower ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Строчные буквы (a-z)
            </div>
            <div className={`flex items-center gap-1 ${strength.hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
              {strength.hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Цифры (0-9)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
