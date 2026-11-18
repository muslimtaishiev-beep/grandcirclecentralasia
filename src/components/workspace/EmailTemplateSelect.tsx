import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { emailApi } from "../../lib/emailTemplatesApi";

/** Выбор шаблона письма для события: «Без письма» или шаблон организации. */
export default function EmailTemplateSelect({ tenantId, value, onChange, title, disabled }: {
  tenantId: string; value: string; onChange: (id: string) => void; title: string; disabled?: boolean;
}) {
  const [list, setList] = useState<{ id: string; name: string }[] | null>(null);
  useEffect(() => {
    let live = true;
    emailApi(tenantId).then(j => live && setList(j.templates)).catch(() => live && setList([]));
    return () => { live = false; };
  }, [tenantId]);
  const missing = value && list && !list.some(x => x.id === value);
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-main)]">
      <Mail className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
      <span>{title}</span>
      <select value={value} disabled={disabled || !list} onChange={e => onChange(e.target.value)}
        className="bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)] max-w-full">
        <option value="">Без письма</option>
        {(list || []).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        {missing && <option value={value}>Шаблон удалён</option>}
      </select>
      <Link to={`/workspace/${tenantId}/settings/emails`} className="text-xs text-[var(--accent)] hover:underline">Шаблоны</Link>
    </label>
  );
}
