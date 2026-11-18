import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { auth } from "../../../lib/firebase";
import type { ExamSettings } from "../../../shared/examRun";
import type { QTemplate } from "../../../shared/questionnaires";
import { btn, input, label } from "../journals/components/ui";
import EmailTemplateSelect from "../../../components/workspace/EmailTemplateSelect";

/**
 * Допуск поступающих к экзамену: для каких классов, какие анкеты до теста
 * (и какие их итоги пускают), вход только по направлению. Кто проводит этап —
 * задано в самой анкете, поэтому этап можно отдать любой должности.
 */
type Gate = NonNullable<ExamSettings["admission"]>;
const chip = (on: boolean) => `px-3 py-1 rounded-full text-xs font-medium border ${on ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] text-[var(--text-main)]"}`;

export default function AdmissionGate({ tenantId, value, onChange }: { tenantId: string; value: Gate; onChange: (g: Gate) => void }) {
  const [templates, setTemplates] = useState<QTemplate[] | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const r = await fetch(`/api/admissions/${tenantId}/templates`, { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json();
        if (!r.ok || !j.success) { setDenied(true); setTemplates([]); return; }
        setTemplates(j.templates.filter((t: QTemplate) => t.audience === "staff"));
      } catch { setTemplates([]); }
    })();
  }, [tenantId]);
  const set = (p: Partial<Gate>) => onChange({ ...value, ...p });
  const grades = Array.from({ length: 11 }, (_, i) => i + 1);
  return (
    <div className="space-y-3">
      <div>
        <span className={label}>Для поступающих в классы</span>
        <div className="flex flex-wrap gap-1.5">
          {grades.map(g => { const on = value.grades.includes(g); return <button key={g} type="button" className={chip(on)} onClick={() => set({ grades: on ? value.grades.filter(x => x !== g) : [...value.grades, g].sort((a, b) => a - b) })}>{g}</button>; })}
        </div>
      </div>
      <div className="space-y-2">
        <span className={label}>До теста пройти</span>
        {value.stages.map((st, k) => {
          const tpl = templates?.find(t => t.id === st.templateId);
          return (
            <div key={k} className="rounded-xl border border-[var(--border-color)] p-2.5 space-y-2">
              <div className="flex gap-2">
                <select className={`${input} flex-1`} value={st.templateId} onChange={e => set({ stages: value.stages.map((x, j) => (j === k ? { templateId: e.target.value, passOutcomes: [] } : x)) })}>
                  {!tpl && <option value={st.templateId}>{templates ? "Анкета не найдена" : "…"}</option>}
                  {(templates || []).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <button type="button" className={btn} onClick={() => set({ stages: value.stages.filter((_, j) => j !== k) })}><Trash2 className="w-4 h-4" /></button>
              </div>
              {tpl?.outcome && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-[var(--text-muted)]">Пускают:</span>
                  {tpl.outcome.options.map(o => {
                    const on = st.passOutcomes.length ? st.passOutcomes.includes(o.id) : o.allowsTest;
                    const cur = st.passOutcomes.length ? st.passOutcomes : tpl.outcome!.options.filter(x => x.allowsTest).map(x => x.id);
                    return <button key={o.id} type="button" className={chip(on)} onClick={() => set({ stages: value.stages.map((x, j) => (j === k ? { ...x, passOutcomes: on ? cur.filter(v => v !== o.id) : [...cur, o.id] } : x)) })}>{o.label}</button>;
                  })}
                </div>
              )}
            </div>
          );
        })}
        {templates && templates.length > 0 && <button type="button" className={btn} onClick={() => set({ stages: [...value.stages, { templateId: templates.find(t => !value.stages.some(s => s.templateId === t.id))?.id || templates[0].id, passOutcomes: [] }] })}><Plus className="w-4 h-4" /> Этап</button>}
        {denied && <p className="text-xs text-[var(--text-muted)]">Анкеты видны сотрудникам с правами раздела «Поступающие».</p>}
      </div>
      <div>
        <span className={label}>Уровень в анкете кандидата</span>
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-main)]">
          средний от <input type="number" min={0} max={100} className={`${input} !w-16`} value={value.levels?.mid ?? 50} onChange={e => set({ levels: { mid: Number(e.target.value) || 0, high: value.levels?.high ?? 77 } })} />%
          отличный от <input type="number" min={0} max={100} className={`${input} !w-16`} value={value.levels?.high ?? 77} onChange={e => set({ levels: { mid: value.levels?.mid ?? 50, high: Number(e.target.value) || 0 } })} />%
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-[var(--text-main)]"><input type="checkbox" className="mt-1" checked={!!value.candidateForm} onChange={e => set({ candidateForm: e.target.checked })} /> <span>Анкета кандидата вместо сертификата и отчёта по темам</span></label>
      <EmailTemplateSelect tenantId={tenantId} title="Письмо родителю с направлением" value={value.referralEmail || ""} onChange={referralEmail => set({ referralEmail })} />
      <label className="flex items-start gap-2 text-sm text-[var(--text-main)]"><input type="checkbox" className="mt-1" checked={value.referralOnly} onChange={e => set({ referralOnly: e.target.checked })} /> <span>Вход только по направлению (QR) — без ручной регистрации</span></label>
    </div>
  );
}
