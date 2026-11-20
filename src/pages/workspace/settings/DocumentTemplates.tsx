import { useEffect, useState, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import { DocumentTemplateService } from '../../../services/tenant/DocumentTemplateService';
import { DocumentTemplate } from '../../../types/engine';
import { useWorkspaceAccess } from '../../../hooks/collab/useWorkspaceAccess';
import { Button, EmptyState, Spinner, PageHeader, confirmDialog, toast, InfoHint } from '../../../components/ui';
import { cleanDocHtml } from '../../../lib/docHtml';

type Draft = Partial<DocumentTemplate>;

export default function DocumentTemplates() {
  // Организация — из адреса (/workspace/:orgId), а не из поддомена.
  const { orgId } = useParams();
  const ctx = useOutletContext<{ activeTenant?: { id: string } } | null>();
  const tenantId = orgId || ctx?.activeTenant?.id;
  const access = useWorkspaceAccess(tenantId);
  const canEdit = access.can('docs:use') || access.can('settings:manage');

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setFailed(false);
    try { setTemplates(await DocumentTemplateService.getTemplates(tenantId)); }
    catch { setFailed(true); }
    finally { setLoading(false); }
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!tenantId || !draft) return;
    if (!draft.name?.trim() || !draft.htmlContent?.trim()) { toast.error('Укажите название и текст шаблона'); return; }
    const vars = (draft.variables || []).filter(v => v.key.trim());
    setSaving(true);
    try {
      await DocumentTemplateService.saveTemplate({
        ...draft,
        id: draft.id || '',
        name: draft.name.trim(),
        htmlContent: cleanDocHtml(draft.htmlContent),
        // Шаблон остаётся в той организации, где создан; общими делает только платформа.
        tenantId: draft.tenantId && draft.tenantId !== 'GLOBAL' ? draft.tenantId : tenantId,
        layout: draft.layout || 'A4-portrait',
        variables: vars.map(v => ({ ...v, key: v.key.trim() })),
      } as DocumentTemplate);
      toast.success('Шаблон сохранён');
      setDraft(null);
      void load();
    } catch (e: any) {
      toast.error(e?.code === 'permission-denied' ? 'Нет прав на изменение шаблонов' : 'Шаблон не сохранён');
    } finally { setSaving(false); }
  };

  const remove = async (t: DocumentTemplate) => {
    if (!(await confirmDialog({ title: `Удалить шаблон «${t.name}»?`, confirmLabel: 'Удалить', danger: true }))) return;
    try { await DocumentTemplateService.deleteTemplate(t.id); toast.success('Шаблон удалён'); void load(); }
    catch (e: any) { toast.error(e?.code === 'permission-denied' ? 'Нет прав на удаление' : 'Не удалось удалить'); }
  };

  const setVar = (i: number, patch: Partial<NonNullable<Draft['variables']>[number]>) =>
    setDraft(d => d && ({ ...d, variables: (d.variables || []).map((v, k) => (k === i ? { ...v, ...patch } : v)) }));

  const field = 'w-full border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Шаблоны документов"
        actions={canEdit && !draft ? <Button icon={<Plus className="w-4 h-4" />} onClick={() => setDraft({ variables: [], layout: 'A4-portrait' })}>Создать шаблон</Button> : undefined}
      />

      {draft ? (
        <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="grid sm:grid-cols-[1fr_200px] gap-3">
            <input className={field} placeholder="Название" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            <select className={field} value={draft.layout || 'A4-portrait'} onChange={e => setDraft({ ...draft, layout: e.target.value as DocumentTemplate['layout'] })}>
              <option value="A4-portrait">A4 вертикальный</option>
              <option value="A4-landscape">A4 горизонтальный</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-main)]">
                Поля
                <InfoHint>В тексте шаблона поле пишется как {'{{ключ}}'}; при выборе шаблона в документе его попросят заполнить.</InfoHint>
              </span>
              <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setDraft({ ...draft, variables: [...(draft.variables || []), { key: '', label: '', type: 'text' }] })}>Поле</Button>
            </div>
            {(draft.variables || []).map((v, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_110px_auto] gap-2 items-center">
                <input className={`${field} font-mono`} placeholder="ключ" value={v.key} onChange={e => setVar(i, { key: e.target.value.replace(/[^\w.-]/g, '') })} />
                <input className={field} placeholder="Название поля" value={v.label} onChange={e => setVar(i, { label: e.target.value })} />
                <select className={field} value={v.type} onChange={e => setVar(i, { type: e.target.value as 'text' | 'date' | 'number' })}>
                  <option value="text">Текст</option>
                  <option value="date">Дата</option>
                  <option value="number">Число</option>
                </select>
                <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, variables: (draft.variables || []).filter((_, k) => k !== i) })}>×</Button>
              </div>
            ))}
          </div>

          <textarea className={`${field} font-mono h-64`} placeholder="<h1>Справка</h1><p>Выдана {{studentName}}</p>"
            value={draft.htmlContent || ''} onChange={e => setDraft({ ...draft, htmlContent: e.target.value })} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDraft(null)}>Отмена</Button>
            <Button loading={saving} onClick={() => void save()}>Сохранить</Button>
          </div>
        </div>
      ) : loading ? (
        <div className="py-16 flex justify-center"><Spinner /></div>
      ) : failed ? (
        <EmptyState title="Не удалось загрузить шаблоны" action={<Button variant="secondary" onClick={() => void load()}>Повторить</Button>} />
      ) : templates.length === 0 ? (
        <EmptyState icon={<FileText className="w-8 h-8" />} title="Шаблонов нет" action={canEdit ? <Button onClick={() => setDraft({ variables: [], layout: 'A4-portrait' })}>Создать шаблон</Button> : undefined} />
      ) : (
        <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-2xl divide-y divide-[var(--border-color)]">
          {templates.map(t => {
            const global = t.tenantId === 'GLOBAL';
            return (
              <div key={t.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--text-main)] flex items-center gap-2 truncate">
                    {t.name}
                    {global && <span className="bg-[var(--bg-surface-hover)] text-[var(--text-muted)] text-[10px] px-2 py-0.5 rounded-full font-bold">Общий</span>}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">Полей: {t.variables?.length || 0}</div>
                </div>
                {canEdit && !global && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => setDraft(t)}>Изменить</Button>
                    <Button size="sm" variant="danger" onClick={() => void remove(t)}>Удалить</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
