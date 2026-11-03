import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { BookOpen, Plus, Loader2, LayoutTemplate } from "lucide-react";
import { BLANK_TEMPLATE, JOURNAL_TEMPLATES, ROLE_LABEL } from "../../../shared/journals";
import { useJournalApi, type JournalListItem } from "./journalApi";
import { Modal, btnPrimary, card, input, label } from "./components/ui";

/** Журналы организации, к которым у сотрудника есть доступ. */
export default function JournalsListPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const tenantId: string = activeTenant?.id || "";
  const api = useJournalApi(tenantId);
  const navigate = useNavigate();
  const [journals, setJournals] = useState<JournalListItem[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true); setError(null);
    try { const j = await api(""); setJournals(j.journals || []); setCanCreate(!!j.canCreate); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [api, tenantId]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Журналы</h1>
          <p className="text-sm text-[var(--text-muted)]">Отработки, инструктажи, выдача имущества — в одном месте, с подписями по QR и статистикой</p>
        </div>
        {canCreate && <button className={btnPrimary} onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> Новый журнал</button>}
      </div>

      {loading && <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>}
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {!loading && !error && journals.length === 0 && (
        <div className={`${card} p-10 text-center space-y-2`}>
          <BookOpen className="w-10 h-10 mx-auto text-[var(--text-muted)]" />
          <p className="text-[var(--text-main)] font-semibold">Журналов пока нет</p>
          <p className="text-sm text-[var(--text-muted)]">
            {canCreate ? "Создайте первый из шаблона — например «Трудовые отработки»." : "Вам ещё не открыли ни одного журнала. Попросите ответственного добавить вас в настройках журнала."}
          </p>
          {canCreate && <button className={btnPrimary} onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> Новый журнал</button>}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {journals.map(j => (
          <Link key={j.id} to={`/workspace/${tenantId}/journals/${j.id}`} className={`${card} p-4 hover:border-[var(--accent)] transition block`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0"><BookOpen className="w-5 h-5" /></div>
              <div className="min-w-0">
                <div className="font-semibold text-[var(--text-main)] truncate">{j.title}</div>
                {j.description && <div className="text-xs text-[var(--text-muted)] line-clamp-2">{j.description}</div>}
                <div className="text-[11px] text-[var(--text-muted)] mt-1">{ROLE_LABEL[j.role]} · изменён {new Date(j.updatedAt).toLocaleDateString("ru-RU")}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {creating && (
        <CreateModal onClose={() => setCreating(false)} onCreate={async (templateKey, title) => {
          const j = await api("", { method: "POST", body: JSON.stringify({ templateKey, title }) });
          navigate(`/workspace/${tenantId}/journals/${j.journal.id}`);
        }} />
      )}
    </div>
  );
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (templateKey: string, title: string) => Promise<void> }) {
  const all = [...JOURNAL_TEMPLATES, { ...BLANK_TEMPLATE, title: "Пустой журнал", description: "Соберите колонки сами" }];
  const [key, setKey] = useState(all[0].key);
  const [title, setTitle] = useState(all[0].title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title="Новый журнал" onClose={onClose}>
      <div className="space-y-3">
        <span className={label}>Шаблон</span>
        <div className="space-y-2">
          {all.map(t => (
            <button key={t.key} onClick={() => { setKey(t.key); setTitle(t.key === "blank" ? "" : t.title); }}
              className={`w-full text-left p-3 rounded-lg border transition ${key === t.key ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]"}`}>
              <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text-main)]"><LayoutTemplate className="w-4 h-4" /> {t.title}</div>
              {t.description && <div className="text-xs text-[var(--text-muted)] mt-0.5">{t.description}</div>}
              {t.key !== "blank" && <div className="text-[11px] text-[var(--text-muted)] mt-1">Колонки: {t.columns.map(c => c.label).join(" · ")}</div>}
            </button>
          ))}
        </div>
        <div><span className={label}>Название</span><input className={input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Например: Отработки 2026/27" /></div>
        <p className="text-[11px] text-[var(--text-muted)]">Колонки, списки и доступ можно поменять потом в настройках журнала.</p>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex justify-end">
          <button className={btnPrimary} disabled={busy} onClick={async () => {
            setBusy(true); setError(null);
            try { await onCreate(key, title); } catch (e: any) { setError(e.message); setBusy(false); }
          }}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Создать</button>
        </div>
      </div>
    </Modal>
  );
}
