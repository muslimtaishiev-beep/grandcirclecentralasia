import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "../../lib/firebase";

/**
 * Распределение по классам.
 *
 * The system proposes, the school decides. Students are ranked by score and
 * split into the school's classes — strongest into А — but nothing is written
 * until the завуч accepts it, and every placement can be moved by hand first.
 *
 * Two age groups can share one parallel (7 младшие / 7 старшие): they are
 * ranked separately and take different letters, because two classes both
 * called "7А" would be indistinguishable in every register afterwards.
 */

type Group = { key: string; grade: number; stream?: string; count: number; firstLetter?: number };
type Student = {
  id: string; shortId: string; studentName: string; grade: number;
  stream?: string; percent: number;
  assignedClass: string | null; proposed: string | null;
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К"];

export default function ClassDistribution({
  tenantId, onChanged,
}: { tenantId: string; onChanged: () => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<number | 0>(0);
  const [editStructure, setEditStructure] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cls, prop] = await Promise.all([
        fetch(`/api/placement/classes?tenantId=${encodeURIComponent(tenantId)}`, { headers: await authHeaders() }).then(r => r.json()),
        fetch("/api/placement/propose-classes", {
          method: "POST", headers: await authHeaders(),
          body: JSON.stringify({ tenantId }),
        }).then(r => r.json()),
      ]);
      if (!cls.success) { setError(cls.error || "Не удалось загрузить структуру классов."); return; }
      if (!prop.success) { setError(prop.error || "Не удалось получить предложение."); return; }
      setGroups(cls.groups || []);
      setStudents(prop.students || []);
      // Уже назначенное имеет приоритет над предложением — школа могла решить.
      const start: Record<string, string> = {};
      (prop.students || []).forEach((s: Student) => {
        if (s.assignedClass || s.proposed) start[s.id] = s.assignedClass || s.proposed!;
      });
      setAssigned(start);
      setError(null);
    } catch (e) { setError("Нет связи с сервером."); }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  /** Все классы, доступные для конкретного ученика: его параллель и группа. */
  const classesFor = (s: Student): string[] => {
    const g = groups.find(x => x.grade === Number(s.grade) &&
      (!x.stream || String(s.stream || "") === x.stream));
    if (!g || g.count < 1) return [];
    const off = g.firstLetter || 0;
    return Array.from({ length: g.count }, (_, i) => `${g.grade}${LETTERS[off + i]}`);
  };

  const visible = useMemo(
    () => students.filter(s => !gradeFilter || Number(s.grade) === gradeFilter),
    [students, gradeFilter]);

  const fill = useMemo(() => {
    const f: Record<string, number> = {};
    Object.values(assigned).forEach(c => { if (c) f[c] = (f[c] || 0) + 1; });
    return f;
  }, [assigned]);

  const unassigned = students.filter(s => !assigned[s.id]).length;
  const changed = students.filter(s => assigned[s.id] && assigned[s.id] !== (s.assignedClass || s.proposed)).length;

  const acceptAll = async () => {
    const toSave = students.filter(s => assigned[s.id] && assigned[s.id] !== s.assignedClass);
    if (!toSave.length) { setNotice("Изменений нет — распределение уже сохранено."); setTimeout(() => setNotice(null), 3000); return; }
    if (!confirm(
      `Сохранить распределение для ${toSave.length} учеников?\n\n` +
      "Ученики увидят класс только после публикации результатов.")) return;

    setSaving(true);
    try {
      // По одному: список редко больше сотни, а частичный отказ виден сразу.
      for (const s of toSave) {
        const res = await fetch("/api/placement/assign-class", {
          method: "POST", headers: await authHeaders(),
          body: JSON.stringify({ tenantId, resultId: s.id, assignedClass: assigned[s.id] }),
        });
        const data = await res.json();
        if (!data.success) { setError(`${s.studentName}: ${data.error}`); setSaving(false); return; }
      }
      setNotice(`Распределение сохранено: ${toSave.length} учеников.`);
      setTimeout(() => setNotice(null), 5000);
      onChanged();
      void load();
    } catch (e) { setError("Нет связи с сервером."); }
    finally { setSaving(false); }
  };

  const saveStructure = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/placement/classes", {
        method: "PUT", headers: await authHeaders(),
        body: JSON.stringify({ tenantId, groups }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Не удалось сохранить."); return; }
      setNotice("Структура классов сохранена. Предложение пересчитано.");
      setTimeout(() => setNotice(null), 4000);
      setEditStructure(false);
      void load();
    } catch (e) { setError("Нет связи с сервером."); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400">
      Считаем распределение…
    </div>;
  }

  return (
    <div className="grid gap-4">
      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>}
      {notice && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">{notice}</div>}

      {/* Структура классов школы */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h3 className="font-bold text-slate-900">Классы школы</h3>
            <p className="text-xs text-slate-500">
              {groups.reduce((a, g) => a + g.count, 0)} классов ·
              буквы идут от сильных к слабым
            </p>
          </div>
          <button onClick={() => setEditStructure(v => !v)}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50">
            {editStructure ? "Свернуть" : "Изменить структуру"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {groups.filter(g => g.count > 0).map(g => {
            const off = g.firstLetter || 0;
            const names = Array.from({ length: g.count }, (_, i) => `${g.grade}${LETTERS[off + i]}`);
            return (
              <div key={g.key} className="border border-slate-200 rounded-lg px-3 py-2">
                <div className="text-xs text-slate-500">
                  {g.grade} класс{g.stream ? ` · ${g.stream}` : ""}
                </div>
                <div className="font-mono font-bold text-slate-800">{names.join(" · ")}</div>
              </div>
            );
          })}
        </div>

        {editStructure && (
          <div className="mt-4 border-t border-slate-100 pt-4 grid gap-2">
            {groups.map((g, i) => (
              <div key={g.key} className="flex items-center gap-2 flex-wrap text-sm">
                <span className="w-32 text-slate-600">
                  {g.grade} класс{g.stream ? ` · ${g.stream}` : ""}
                </span>
                <label className="text-slate-500 text-xs">классов:</label>
                <input value={g.count} inputMode="numeric"
                  onChange={e => setGroups(gs => gs.map((x, j) => j === i
                    ? { ...x, count: Math.max(0, Math.min(10, Number(e.target.value.replace(/\D/g, "")) || 0)) } : x))}
                  className="w-14 border border-slate-300 rounded-lg px-2 py-1 text-center font-mono" />
                <label className="text-slate-500 text-xs">с буквы:</label>
                <select value={g.firstLetter || 0}
                  onChange={e => setGroups(gs => gs.map((x, j) => j === i
                    ? { ...x, firstLetter: Number(e.target.value) } : x))}
                  className="border border-slate-300 rounded-lg px-2 py-1">
                  {LETTERS.map((l, n) => <option key={l} value={n}>{l}</option>)}
                </select>
                <span className="text-xs text-slate-400">
                  → {Array.from({ length: g.count }, (_, n) => `${g.grade}${LETTERS[(g.firstLetter || 0) + n]}`).join(", ") || "нет классов"}
                </span>
              </div>
            ))}
            <button onClick={saveStructure} disabled={saving}
              className="justify-self-start mt-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-sm">
              {saving ? "Сохраняем…" : "Сохранить структуру"}
            </button>
          </div>
        )}
      </div>

      {/* Наполняемость */}
      {Object.keys(fill).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-bold text-slate-900 mb-3">Наполняемость</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(fill).sort(([a], [b]) => a.localeCompare(b, "ru")).map(([cls, n]) => (
              <div key={cls} className="border border-slate-200 rounded-lg px-3 py-2 text-center min-w-[64px]">
                <div className="font-mono font-bold text-slate-800">{cls}</div>
                <div className="text-xs text-slate-500">{n} чел.</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Список учеников */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-slate-900">Предложение системы</h3>
          <span className="text-xs text-slate-500">
            сортировка по баллу · сильные в первую букву
          </span>
          <div className="ml-auto flex gap-1 flex-wrap">
            <button onClick={() => setGradeFilter(0)}
              className={`px-3 h-8 rounded-lg text-sm font-semibold border ${
                gradeFilter === 0 ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>
              все
            </button>
            {[...new Set(students.map(s => Number(s.grade)))].sort((a, b) => a - b).map(g => (
              <button key={g} onClick={() => setGradeFilter(g)}
                className={`w-9 h-8 rounded-lg text-sm font-semibold border ${
                  gradeFilter === g ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            Нет работ, ожидающих распределения. Появятся после того, как ученики сдадут экзамен.
          </div>
        ) : (
          <div className="max-h-[26rem] overflow-y-auto">
            {visible.map(s => {
              const options = classesFor(s);
              const value = assigned[s.id] || "";
              const moved = value && value !== s.proposed;
              return (
                <div key={s.id} className="px-5 py-2.5 border-b border-slate-100 last:border-0 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {s.studentName}
                      {s.stream && <span className="ml-2 text-xs text-slate-400">{s.stream}</span>}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {s.shortId} · {s.grade} кл · {s.percent}%
                    </div>
                  </div>
                  {options.length === 0 ? (
                    <span className="text-xs text-amber-600">
                      нет классов для этой параллели
                    </span>
                  ) : (
                    <select value={value}
                      onChange={e => setAssigned(a => ({ ...a, [s.id]: e.target.value }))}
                      className={`border rounded-lg px-3 py-1.5 text-sm font-mono font-bold ${
                        moved ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-800"}`}>
                      <option value="">— не назначен —</option>
                      {options.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  {moved && <span className="text-xs text-blue-600">изменено</span>}
                </div>
              );
            })}
          </div>
        )}

        <div className="px-5 py-4 border-t border-slate-200 flex items-center gap-3 flex-wrap">
          <button onClick={acceptAll} disabled={saving || students.length === 0}
            className={`px-5 py-2.5 rounded-xl font-bold text-white text-sm ${
              saving || students.length === 0 ? "bg-slate-400" : "bg-emerald-600 hover:bg-emerald-700"}`}>
            {saving ? "Сохраняем…" : "Принять распределение"}
          </button>
          <button onClick={() => void load()} disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm">
            Пересчитать заново
          </button>
          <span className="text-xs text-slate-500 ml-auto">
            {unassigned > 0 && <span className="text-amber-600 font-medium">без класса: {unassigned} · </span>}
            {changed > 0 && <span className="text-blue-600 font-medium">изменено вручную: {changed} · </span>}
            ученики увидят класс только после публикации
          </span>
        </div>
      </div>
    </div>
  );
}
