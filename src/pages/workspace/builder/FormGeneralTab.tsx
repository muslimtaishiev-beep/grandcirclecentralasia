import React, { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Copy, Download, QrCode } from "lucide-react";
import { auth, db } from "../../../lib/firebase";
import { Button, InfoHint, confirmDialog, toast } from "../../../components/ui";
import EmailTemplateSelect from "../../../components/workspace/EmailTemplateSelect";
import FancyQr, { QR_THEMES, QrThemePicker, downloadQr, type QrTheme } from "../../../components/forms/FancyQr";
import type { FormMode } from "../../../shared/formStatuses";

const input = "w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]";

interface Draft { title: string; description: string; mode: FormMode; qrTrackingEnabled: boolean; publicListed: boolean; emailTemplateId: string }

const fromForm = (f: any): Draft => ({
  title: String(f.title || ""), description: String(f.description || ""),
  mode: f.mode === "ticket" ? "ticket" : "application",
  qrTrackingEnabled: f.qrTrackingEnabled !== false, publicListed: f.publicListed === true,
  emailTemplateId: String(f.emailTemplateId || ""),
});

/** Вкладка «Общее» настроек формы: всё, кроме вопросов (они — в «Изменить»). */
export default function FormGeneralTab({ tenantId, form, qrLogo, onClose }: {
  tenantId: string; form: any; qrLogo?: string; onClose: () => void;
}) {
  const [saved, setSaved] = useState<Draft>(() => fromForm(form));
  const [d, setD] = useState<Draft>(() => fromForm(form));
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [theme, setTheme] = useState<QrTheme>(QR_THEMES[0]);
  const url = `${window.location.origin}/form/${form.id}`;
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }));

  const save = async () => {
    if (!d.title.trim()) return;
    setSaving(true);
    try {
      const next = { ...d, title: d.title.trim(), description: d.description.trim() };
      await setDoc(doc(db, "custom_forms", form.id), {
        tenantId, title: next.title, description: next.description, mode: next.mode,
        qrTrackingEnabled: next.qrTrackingEnabled, publicListed: next.publicListed,
        emailTemplateId: next.emailTemplateId, updatedAt: serverTimestamp(),
      }, { merge: true });
      setD(next); setSaved(next);
      toast.success("Сохранено");
    } catch (e: any) { toast.error(`Не удалось сохранить: ${e?.message || e}`); }
    finally { setSaving(false); }
  };

  const state = async (action: "close" | "open" | "archive") => {
    if (action === "archive" && !(await confirmDialog({
      title: `Убрать форму «${form.title}» в архив?`, message: "Приём заявок закроется, заявки сохранятся. Форму можно вернуть.",
      confirmLabel: "В архив", danger: true,
    }))) return;
    setBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/forms/form-state", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId, formId: form.id, action }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || `Ошибка ${r.status}`);
      if (action === "archive") { toast.success("Форма в архиве"); onClose(); }
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success("Ссылка скопирована"); } catch { toast.error("Не удалось скопировать"); }
  };

  const open = form.active !== false;
  const check = "flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer";
  const label = "block text-xs font-semibold text-[var(--text-muted)] mb-1";

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div><label className={label}>Название</label>
          <input value={d.title} maxLength={120} onChange={e => set("title", e.target.value)} className={input} /></div>
        <div><label className={label}>Описание</label>
          <input value={d.description} onChange={e => set("description", e.target.value)} className={input} /></div>
      </div>

      <div className="space-y-2">
        <div className={label}>Режим</div>
        <div className="flex gap-2">
          {([["application", "Приём заявок"], ["ticket", "Билеты на событие"]] as const).map(([m, t]) => (
            <button key={m} type="button" onClick={() => set("mode", m)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${d.mode === m ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]"}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <label className={check}>
          <input type="checkbox" checked={open} disabled={busy || !!form.archived} onChange={() => void state(open ? "close" : "open")} />
          Приём заявок открыт
        </label>
        <label className={check}>
          <input type="checkbox" checked={d.qrTrackingEnabled} onChange={e => set("qrTrackingEnabled", e.target.checked)} />
          QR-код отслеживания после отправки
        </label>
        <label className={check}>
          <input type="checkbox" checked={d.publicListed} onChange={e => set("publicListed", e.target.checked)} />
          Показывать в списке анкет для внешних сайтов
          <InfoHint>Анкету увидят на сторонних страницах организации. Ссылка работает и без этого.</InfoHint>
        </label>
        <EmailTemplateSelect tenantId={tenantId} kind="form" title="Письмо после подачи" value={d.emailTemplateId} onChange={v => set("emailTemplateId", v)} />
      </div>

      <div className="space-y-2">
        <div className={label}>Ссылка на форму</div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 min-w-[200px] truncate rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-xs">{url}</code>
          <Button size="sm" variant="secondary" icon={<Copy className="w-4 h-4" />} onClick={() => void copy()}>Копировать</Button>
          <Button size="sm" variant="secondary" icon={<QrCode className="w-4 h-4" />} onClick={() => setShowQr(v => !v)}>QR</Button>
        </div>
        {showQr && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
            <FancyQr value={url} theme={theme} size={200} logo={qrLogo} />
            <QrThemePicker value={theme.key} onChange={setTheme} />
            <Button size="sm" variant="secondary" icon={<Download className="w-4 h-4" />}
              onClick={() => downloadQr(url, theme, `QR-${form.title}.png`, 1024, qrLogo)}>Скачать</Button>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Закрыть</Button>
        <Button variant="primary" loading={saving} disabled={!dirty || !d.title.trim()} onClick={() => void save()}>Сохранить</Button>
      </div>

      {!form.archived && (
        <div className="border-t border-red-500/30 pt-4 space-y-2">
          <div className="text-xs font-semibold text-red-500">Опасная зона</div>
          <Button variant="danger" disabled={busy} onClick={() => void state("archive")}>Убрать форму в архив</Button>
        </div>
      )}
    </div>
  );
}
