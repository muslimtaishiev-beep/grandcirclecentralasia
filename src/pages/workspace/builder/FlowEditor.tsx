import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { auth } from "../../../lib/firebase";
import { emailApi } from "../../../lib/emailTemplatesApi";
import { Button, Modal, toast } from "../../../components/ui";
import { MAX_STEPS, resolveFlow, type FlowStep, type FormFlow } from "../../../shared/formFlow";
import FlowCanvas from "./FlowCanvas";
import FlowPanel from "./FlowPanel";

async function saveFlowApi(tenantId: string, formId: string, flow: FormFlow): Promise<FormFlow> {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch("/api/forms/flow", {
    method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tenantId, formId, flow }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) throw new Error(j.error || `Ошибка ${r.status}`);
  return j.flow as FormFlow;
}

type Ask = { kind: "close" } | { kind: "delete"; id: string } | null;

/** Полноэкранный конструктор этапов формы. */
export default function FlowEditor({ tenantId, form, onClose, onSaved }: {
  tenantId: string; form: any; onClose: () => void; onSaved?: (flow: FormFlow) => void;
}) {
  const [steps, setSteps] = useState<FlowStep[]>(() => resolveFlow(form).steps);
  const [saved, setSaved] = useState(() => JSON.stringify(resolveFlow(form).steps));
  const [sel, setSel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ask, setAsk] = useState<Ask>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    emailApi(tenantId).then(j => setTemplates((j.templates || []).filter((x: any) => x.kind === "form" || x.kind === "any"))).catch(() => {});
  }, [tenantId]);

  const dirty = JSON.stringify(steps) !== saved;
  const step = steps.find(s => s.id === sel) || null;
  const templateName = useCallback((id?: string) => templates.find(t => t.id === id)?.name || "Шаблон", [templates]);

  const descendants = useMemo(() => {
    const out = new Set<string>();
    if (!sel) return out;
    const walk = (id: string) => { for (const s of steps) if (s.after.kind === "step" && s.after.id === id && !out.has(s.id)) { out.add(s.id); walk(s.id); } };
    walk(sel);
    return out;
  }, [steps, sel]);

  const addStep = (after: FlowStep["after"]) => {
    if (steps.length >= MAX_STEPS) { toast.error(`Не больше ${MAX_STEPS} этапов`); return; }
    const id = `s_${Math.random().toString(36).slice(2, 8)}`;
    setSteps(l => [...l, { id, title: "Новый этап", after, marks: [], minMarks: 0, comment: false }]);
    setSel(id);
  };
  const patch = (id: string, p: Partial<FlowStep>) => setSteps(l => l.map(s => {
    if (s.id !== id) return s;
    const n = { ...s, ...p };
    if ("emailTemplateId" in p && !p.emailTemplateId) delete n.emailTemplateId;
    if ("when" in p && !p.when) delete n.when;
    return n;
  }));

  const removeStep = (id: string, withKids: boolean) => {
    const target = steps.find(s => s.id === id);
    if (!target) return;
    if (withKids) {
      const gone = new Set<string>([id]);
      let grew = true;
      while (grew) { grew = false; for (const s of steps) if (s.after.kind === "step" && gone.has(s.after.id) && !gone.has(s.id)) { gone.add(s.id); grew = true; } }
      setSteps(l => l.filter(s => !gone.has(s.id)));
    } else {
      setSteps(l => l.filter(s => s.id !== id).map(s => (s.after.kind === "step" && s.after.id === id ? { ...s, after: target.after } : s)));
    }
    setSel(null); setAsk(null);
  };
  const askDelete = (id: string) => {
    if (steps.some(s => s.after.kind === "step" && s.after.id === id)) setAsk({ kind: "delete", id });
    else removeStep(id, true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const flow = await saveFlowApi(tenantId, form.id, { steps });
      setSteps(flow.steps); setSaved(JSON.stringify(flow.steps));
      if (sel && !flow.steps.some(s => s.id === sel)) setSel(null);
      onSaved?.(flow);
      toast.success("Сохранено");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  const close = () => (dirty ? setAsk({ kind: "close" }) : onClose());

  return (
    <div className="fixed inset-0 z-[60] bg-[var(--bg-app)] flex flex-col text-[var(--text-main)]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0">
        <button className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm hover:bg-[var(--bg-surface-hover)]" onClick={close} aria-label="Назад"><ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Назад</span></button>
        <div className="font-bold truncate flex-1">Этапы · {form.title}</div>
        <Button variant="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>Сохранить</Button>
      </div>
      <div className="flex-1 min-h-0 flex">
        <FlowCanvas form={form} steps={steps} selectedId={sel} templateName={templateName}
          onSelect={setSel} onAddToState={id => addStep({ kind: "status", id })} onAddToStep={id => addStep({ kind: "step", id })} />
        <FlowPanel tenantId={tenantId} form={form} steps={steps} step={step} descendants={descendants} templates={templates}
          onPatch={patch} onDelete={askDelete} onClose={() => setSel(null)} />
      </div>
      {ask?.kind === "close" && (
        <Modal title="Выйти без сохранения?" onClose={() => setAsk(null)}>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setAsk(null)}>Остаться</Button>
            <Button variant="danger" onClick={onClose}>Выйти без сохранения</Button>
          </div>
        </Modal>
      )}
      {ask?.kind === "delete" && (
        <Modal title="Удалить этап" onClose={() => setAsk(null)}>
          <div className="flex flex-col gap-2">
            <Button variant="danger" onClick={() => removeStep(ask.id, true)}>Удалить вместе с ветками</Button>
            <Button variant="secondary" onClick={() => removeStep(ask.id, false)}>Оставить ветки, подвесить выше</Button>
            <Button variant="ghost" onClick={() => setAsk(null)}>Отмена</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
