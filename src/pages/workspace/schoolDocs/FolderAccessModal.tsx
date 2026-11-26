import { useState } from "react";
import { Button, Modal, Tabs } from "../../../components/ui";
import { EMPTY_AUDIENCE, ROOT_ACCESS, type FolderAccess } from "../../../shared/schoolDocs";
import AudiencePicker, { type DocsStaff } from "./AudiencePicker";

/** Доступ к папке: кто видит, кто загружает, видят ли все файлы, кто ещё управляет. */
export default function FolderAccessModal({ name, value, root, staff, positions, onClose, onSave }: {
  name: string; value: FolderAccess; root: boolean; staff: DocsStaff[]; positions: { id: string; name: string }[];
  onClose: () => void; onSave: (a: FolderAccess) => Promise<void>;
}) {
  const [a, setA] = useState<FolderAccess>(() => ({ ...ROOT_ACCESS, ...value, view: { ...EMPTY_AUDIENCE, ...value.view }, upload: { ...EMPTY_AUDIENCE, ...value.upload } }));
  const [tab, setTab] = useState("view");
  const [busy, setBusy] = useState(false);
  const inherit = !root && a.inherit;
  return (
    <Modal title={`Доступ · ${name}`} onClose={() => !busy && onClose()} wide>
      <div className="space-y-4">
        {!root && (
          <label className="flex items-center gap-2 text-sm text-[var(--text-main)]">
            <input type="checkbox" checked={a.inherit} onChange={e => setA({ ...a, inherit: e.target.checked })} /> Как у папки выше
          </label>
        )}
        {!inherit && (
          <>
            <Tabs tabs={[{ id: "view", label: "Кто видит" }, { id: "upload", label: "Кто загружает" }, { id: "managers", label: "Кто управляет" }]} value={tab} onChange={setTab} />
            {tab === "view" && <AudiencePicker value={a.view} onChange={view => setA({ ...a, view })} staff={staff} positions={positions} allLabel="Вся школа" />}
            {tab === "upload" && <AudiencePicker value={a.upload} onChange={upload => setA({ ...a, upload })} staff={staff} positions={positions} allLabel="Все сотрудники" />}
            {tab === "managers" && (
              <div className="space-y-2">
                <AudiencePicker value={{ ...EMPTY_AUDIENCE, include: a.managers }} onChange={x => setA({ ...a, managers: x.include })} staff={staff} positions={[]} hideList peopleOnly />
              </div>
            )}
            <label className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] p-3 text-sm text-[var(--text-main)]">
              <input type="checkbox" checked={a.ownOnly} onChange={e => setA({ ...a, ownOnly: e.target.checked })} />
              Загружающие видят только свои файлы
            </label>
          </>
        )}
        <div className="flex justify-end gap-2 border-t border-[var(--border-color)] pt-3">
          <Button onClick={onClose} disabled={busy}>Отмена</Button>
          <Button variant="primary" loading={busy} onClick={async () => { setBusy(true); try { await onSave(a); } finally { setBusy(false); } }}>Сохранить</Button>
        </div>
      </div>
    </Modal>
  );
}
