import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { CandidateDecisionOption, CandidateFormConfig } from "../../../shared/candidateForm";
import { Button, toast } from "../../../components/ui";
import { btn, input } from "../journals/components/ui";
import { useAdmissionApi } from "../admissions/admissionApi";

/**
 * Решения вступительного экзамена — те же варианты, что в «Анкете кандидата»
 * (Приём → Анкеты): правка здесь меняет их и в «Поступающих».
 */
export default function CandidateDecisionsEditor({ tenantId }: { tenantId: string }) {
  const api = useAdmissionApi(tenantId);
  const [form, setForm] = useState<CandidateFormConfig | null>(null);
  const [list, setList] = useState<CandidateDecisionOption[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    api("/candidate-form").then(j => { setForm(j.form); setList(j.form.decisions); setCanEdit(!!j.canEdit); }).catch(() => {});
  }, [api]);
  if (!form) return null;
  const upd = (i: number, p: Partial<CandidateDecisionOption>) => { setList(l => l.map((x, k) => (k === i ? { ...x, ...p } : x))); setDirty(true); };
  const save = async () => {
    setBusy(true);
    try {
      const j = await api("/candidate-form", { method: "PUT", body: JSON.stringify({ ...form, decisions: list }) });
      setForm(j.form); setList(j.form.decisions); setDirty(false); toast.success("Решения сохранены");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold text-[var(--text-main)]">Решения по поступающему</span>
      {list.map((d, i) => (
        <div key={d.id} className="flex flex-wrap items-center gap-2">
          <input className={`${input} flex-1 min-w-[160px]`} value={d.label} disabled={!canEdit} onChange={e => upd(i, { label: e.target.value })} />
          <label className="flex items-center gap-1 text-xs text-[var(--text-main)]"><input type="checkbox" checked={d.final} disabled={!canEdit} onChange={e => upd(i, { final: e.target.checked })} /> решение принято</label>
          {canEdit && <button type="button" className={btn} disabled={list.length < 2} onClick={() => { setList(l => l.filter((_, k) => k !== i)); setDirty(true); }}><Trash2 className="w-4 h-4 text-rose-600" /></button>}
        </div>
      ))}
      {canEdit && (
        <div className="flex gap-2">
          <button type="button" className={btn} onClick={() => { setList(l => [...l, { id: `d${Math.random().toString(36).slice(2, 7)}`, label: "Новое решение", final: true }]); setDirty(true); }}><Plus className="w-4 h-4" /> Вариант</button>
          {dirty && <Button size="sm" loading={busy} onClick={save}>Сохранить решения</Button>}
        </div>
      )}
    </div>
  );
}
