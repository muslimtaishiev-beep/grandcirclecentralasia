import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { Crown, Edit3, FolderTree, Plus, Search, Trash2, UserCheck, Users } from "lucide-react";
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Button, EmptyState, PageHeader, Spinner, confirmDialog, toast } from "../../../components/ui";
import { Modal, card, input, label } from "../../../components/ui";

interface Department {
  id: string;
  name: string;
  description?: string;
  headUserId?: string | null;
  memberIds?: string[];
}
interface Member {
  id: string;
  userId?: string;
  displayName?: string;
  name?: string;
  email?: string;
}

const memberName = (m: Member) => m.displayName || m.name || m.email || "Сотрудник";

/** Отделы организации. Создаёт и удаляет только сама организация — готовых наборов нет. */
export default function OrgStructure() {
  const { activeTenant } = useOutletContext<{ activeTenant?: { id?: string } } | null>() || {};
  const { orgId } = useParams();
  const tenantId = activeTenant?.id || orgId || "";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [q, setQ] = useState("");

  const [editing, setEditing] = useState<Department | "new" | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [head, setHead] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true); setError(null);
    const fail = () => { setError("Не удалось загрузить отделы"); setLoading(false); };
    const unsubMembers = onSnapshot(
      query(collection(db, "memberships"), where("tenantId", "==", tenantId)),
      snap => setMembers(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Member, "id">) }))),
      fail,
    );
    const unsubDepts = onSnapshot(
      query(collection(db, "departments"), where("tenantId", "==", tenantId)),
      snap => { setDepartments(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Department, "id">) }))); setLoading(false); },
      fail,
    );
    return () => { unsubDepts(); unsubMembers(); };
  }, [tenantId, attempt]);

  const open = (d: Department | "new") => {
    setEditing(d);
    setName(d === "new" ? "" : d.name || "");
    setDesc(d === "new" ? "" : d.description || "");
    setHead(d === "new" ? "" : d.headUserId || "");
    setPicked(d === "new" ? [] : d.memberIds || []);
  };

  const save = async () => {
    if (!name.trim() || !editing) return;
    setBusy(true);
    try {
      const isNew = editing === "new";
      const id = isNew ? `dept_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` : editing.id;
      await setDoc(doc(db, "departments", id), {
        tenantId, name: name.trim(), description: desc.trim(), headUserId: head || null, memberIds: picked,
        updatedAt: serverTimestamp(), ...(isNew ? { createdAt: serverTimestamp() } : {}),
      }, { merge: true });
      toast.success(isNew ? "Отдел создан" : "Сохранено");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally { setBusy(false); }
  };

  const remove = useCallback(async (d: Department) => {
    if (!(await confirmDialog({ title: `Удалить отдел «${d.name}»?`, confirmLabel: "Удалить", danger: true }))) return;
    try { await deleteDoc(doc(db, "departments", d.id)); toast.success("Отдел удалён"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Не удалось удалить"); }
  }, []);

  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
  const shown = departments
    .filter(d => !q.trim() || d.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return (
    <div className="max-w-6xl mx-auto space-y-4 text-[var(--text-main)]">
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><FolderTree className="w-6 h-6 text-[var(--accent)]" />Отделы</span>}
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={() => open("new")}>Создать отдел</Button>}
      />

      {departments.length > 6 && (
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input className={`${input} pl-9`} placeholder="Поиск по названию" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner /></div>
      ) : error ? (
        <EmptyState title={error} action={<Button variant="secondary" onClick={() => setAttempt(a => a + 1)}>Повторить</Button>} />
      ) : !departments.length ? (
        <EmptyState icon={<FolderTree className="w-10 h-10" />} title="Отделов пока нет" action={<Button onClick={() => open("new")}>Создать отдел</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map(d => {
            const headM = d.headUserId ? byId.get(d.headUserId) : undefined;
            const people = (d.memberIds || []).map(id => byId.get(id)).filter((m): m is Member => !!m);
            return (
              <div key={d.id} className={`${card} p-4 space-y-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold truncate">{d.name}</h3>
                    {d.description && <div className="text-xs text-[var(--text-muted)] line-clamp-2">{d.description}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => open(d)} title="Изменить" icon={<Edit3 className="w-4 h-4" />} />
                    <Button variant="ghost" size="sm" onClick={() => void remove(d)} title="Удалить" icon={<Trash2 className="w-4 h-4 text-rose-600" />} />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className={headM ? "" : "text-[var(--text-muted)]"}>{headM ? memberName(headM) : "Руководитель не назначен"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]"><Users className="w-3.5 h-3.5" />{people.length}</span>
                  {people.map(m => (
                    <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--bg-surface-hover)] text-xs">
                      <UserCheck className="w-3 h-3 text-[var(--accent)]" />{memberName(m)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "Новый отдел" : "Отдел"} onClose={() => setEditing(null)} wide>
          <div className="space-y-4">
            <div><span className={label}>Название</span><input className={input} value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
            <div><span className={label}>Описание</span><textarea className={input} rows={2} value={desc} onChange={e => setDesc(e.target.value)} /></div>
            <div>
              <span className={label}>Руководитель</span>
              <select className={input} value={head} onChange={e => setHead(e.target.value)}>
                <option value="">Не выбран</option>
                {members.map(m => <option key={m.id} value={m.id}>{memberName(m)}{m.email && m.email !== memberName(m) ? ` · ${m.email}` : ""}</option>)}
              </select>
            </div>
            <div>
              <span className={label}>Сотрудники</span>
              <div className="grid sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto">
                {members.map(m => {
                  const on = picked.includes(m.id);
                  return (
                    <label key={m.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${on ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-color)]"}`}>
                      <input type="checkbox" checked={on} onChange={() => setPicked(p => on ? p.filter(x => x !== m.id) : [...p, m.id])} />
                      <span className="min-w-0 truncate">{memberName(m)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
              <Button variant="secondary" onClick={() => setEditing(null)}>Отмена</Button>
              <Button onClick={() => void save()} loading={busy} disabled={!name.trim()}>Сохранить</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
