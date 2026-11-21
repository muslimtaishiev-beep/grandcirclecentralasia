import React, { useCallback, useEffect, useState } from "react";
import { Copy, Plus, Trash2, X } from "lucide-react";
import { Button, EmptyState, Spinner, confirmDialog, toast } from "../../../components/ui";
import { DEFAULT_VARIANT_KEY, PRESETS, blankVariant, type ResultPage, type Variant } from "../../../shared/resultPages";
import { Thumb, type OrgInfo } from "./EditorKit";
import { rpApi, type PageRow } from "./resultPagesApi";

const card = "rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 space-y-2 flex flex-col";

function PageThumb({ tenantId, id, org }: { tenantId: string; id: string; org: OrgInfo }) {
  const [v, setV] = useState<Variant | null>(null);
  useEffect(() => {
    let live = true;
    rpApi(tenantId, `/${id}`).then(j => { const p = j.page as ResultPage; if (live) setV(p.variants[DEFAULT_VARIANT_KEY] || Object.values(p.variants)[0] || null); }).catch(() => {});
    return () => { live = false; };
  }, [tenantId, id]);
  return v ? <Thumb variant={v} org={org} width={220} /> : <div className="h-[150px] rounded-md bg-[var(--bg-surface-hover)] flex items-center justify-center"><Spinner /></div>;
}

/** Галерея: готовые шаблоны и свои страницы организации — выбрать, привязать или создать копию. */
export default function TemplateGallery({ tenantId, org, currentId, onPick, onClose }: {
  tenantId: string; org: OrgInfo; currentId: string | null; onPick: (id: string, name: string) => void; onClose: () => void;
}) {
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => { rpApi(tenantId).then(j => setPages(j.pages)).catch(e => { toast.error(e.message); setPages([]); }); }, [tenantId]);
  useEffect(() => { load(); }, [load]);

  const create = async (key: string, body: Record<string, unknown>, name: string) => {
    setBusy(key);
    try { const j = await rpApi(tenantId, "", { method: "POST", body: JSON.stringify(body) }); onPick(j.id, name); }
    catch (e: any) { toast.error(e.message); setBusy(""); }
  };
  const copy = async (p: PageRow) => {
    setBusy(`c${p.id}`);
    try {
      const full = (await rpApi(tenantId, `/${p.id}`)).page as ResultPage;
      const name = `${p.name} (копия)`.slice(0, 80);
      const j = await rpApi(tenantId, "", { method: "POST", body: JSON.stringify({ name, variants: full.variants }) });
      onPick(j.id, name);
    } catch (e: any) { toast.error(e.message); setBusy(""); }
  };
  const remove = async (p: PageRow) => {
    if (!(await confirmDialog({ title: `Удалить «${p.name}»?`, confirmLabel: "Удалить", danger: true }))) return;
    try { await rpApi(tenantId, `/${p.id}`, { method: "DELETE" }); load(); }
    catch (e: any) { toast.error(e.status === 409 ? "Страница выбрана в настройках экзамена" : e.message); }
  };

  return (
    <div className="absolute inset-0 z-30 bg-[var(--bg-app)] flex flex-col">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0">
        <h3 className="font-bold text-[var(--text-main)]">Шаблоны</h3>
        <button className="ml-auto p-2 rounded-lg hover:bg-[var(--bg-surface-hover)] text-[var(--text-main)]" onClick={onClose} aria-label="Закрыть"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Готовые</h4>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(244px,1fr))]">
            <div className={card}>
              <div className="h-[150px] rounded-md border border-dashed border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)]"><Plus className="w-6 h-6" /></div>
              <div className="font-semibold text-sm text-[var(--text-main)]">Пустая страница</div>
              <Button size="sm" className="mt-auto" loading={busy === "blank"} onClick={() => create("blank", { name: "Новая страница", variants: { [DEFAULT_VARIANT_KEY]: blankVariant() } }, "Новая страница")}>Создать</Button>
            </div>
            {PRESETS.map(p => (
              <div key={p.id} className={card}>
                <Thumb variant={p.variant} org={org} width={220} />
                <div className="font-semibold text-sm text-[var(--text-main)]">{p.name}</div>
                <Button size="sm" className="mt-auto" loading={busy === p.id} onClick={() => create(p.id, { presetId: p.id }, p.name)}>Создать из шаблона</Button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Страницы организации</h4>
          {!pages ? <Spinner /> : !pages.length ? <EmptyState title="Своих страниц пока нет" /> : (
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(244px,1fr))]">
              {pages.map(p => (
                <div key={p.id} className={`${card} ${p.id === currentId ? "!border-[var(--accent)]" : ""}`}>
                  <PageThumb tenantId={tenantId} id={p.id} org={org} />
                  <div className="font-semibold text-sm text-[var(--text-main)] truncate">{p.name}</div>
                  <div className="flex gap-1.5 mt-auto">
                    <Button size="sm" className="flex-1" variant={p.id === currentId ? "secondary" : "primary"} onClick={() => onPick(p.id, p.name)}>{p.id === currentId ? "Текущая" : "Выбрать"}</Button>
                    <Button size="sm" variant="secondary" title="Создать копию" loading={busy === `c${p.id}`} icon={<Copy className="w-3.5 h-3.5" />} onClick={() => copy(p)} />
                    <Button size="sm" variant="ghost" title="Удалить" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => remove(p)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
