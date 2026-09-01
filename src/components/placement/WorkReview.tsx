import { useCallback, useEffect, useState } from "react";
import { auth } from "../../lib/firebase";

/**
 * Проверка работы с черновиком в руках.
 *
 * The teacher sits with the student's rough paper and walks the questions one
 * by one. Every item shows what was asked, what the student clicked and what
 * the key says; the machine's verdict is the starting point, not the last word.
 *
 * Three marks per question — 0, 0.5, 1 — because a draft often shows correct
 * working with a mis-clicked answer, and "half" is the honest answer to that.
 * Changing a mark asks for confirmation: this is someone's placement, and a
 * mis-tap while flipping through papers should not silently change it.
 */

type Item = {
  id: string; topic: string; difficulty: number; type: string;
  text: string; options: string[];
  given: string; answer: string;
  autoCorrect: boolean; mark: number; overridden: boolean; overrideNote?: string;
};
type Section = { key: string; title: string; correct: number; total: number; percent: number; items?: Item[] };
type Work = {
  id: string; shortId: string; studentName: string; grade: number;
  correct: number; total: number; percent: number; satMath: number | null;
  recommendation: string; reviewStatus?: string; reviewedBy?: string;
  published?: boolean; annulled?: boolean; sections: Section[];
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const LETTERS = ["А", "Б", "В", "Г", "Д", "Е"];
const DIFF: Record<number, string> = { 1: "лёгкий", 2: "средний", 3: "сложный" };

export default function WorkReview({
  tenantId, resultId, onClose, onChanged,
}: { tenantId: string; resultId: string; onClose: () => void; onChanged: () => void }) {
  const [work, setWork] = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [onlyWrong, setOnlyWrong] = useState(false);
  // Открыт ровно один вопрос: учитель идёт по списку с черновиком, окно с
  // заданием закрывается само при переходе к следующему — иначе на экране
  // копится десяток развёрнутых карточек и найти текущую невозможно.
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/placement/review/${encodeURIComponent(resultId)}?tenantId=${encodeURIComponent(tenantId)}`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Не удалось загрузить работу."); return; }
      setWork(data.result);
      setError(null);
    } catch (e) { setError("Нет связи с сервером."); }
    finally { setLoading(false); }
  }, [tenantId, resultId]);

  useEffect(() => { void load(); }, [load]);

  const setMark = async (sectionKey: string, item: Item, mark: number): Promise<boolean> => {
    if (work?.published) { setError("Результаты опубликованы — правка закрыта."); return false; }
    // Подтверждение только когда учитель СПОРИТ с машиной: соглашаться с
    // верным вердиктом придётся десятки раз за класс, и попап на каждом
    // превращает проверку в кликанье «ОК».
    const machineMark = item.autoCorrect ? 1 : 0;
    if (mark !== machineMark) {
      const label = mark === 0 ? "не засчитывать" : mark === 0.5 ? "засчитать наполовину" : "засчитать полностью";
      if (!confirm(
        `Вопрос: ${item.text.slice(0, 70)}${item.text.length > 70 ? "…" : ""}\n\n` +
        `Машина посчитала: ${item.autoCorrect ? "верно (1)" : "неверно (0)"}\n` +
        `Вы ставите: ${mark === 0.5 ? "½" : mark}\n\n${label}?`)) return false;
    }

    const note = mark !== (item.autoCorrect ? 1 : 0)
      ? (prompt("Основание (увидит комиссия при спорах):", item.overrideNote || "Проверка черновика") ?? "")
      : "";

    setBusy(item.id);
    try {
      const res = await fetch("/api/placement/review/mark", {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ tenantId, resultId, sectionKey, questionId: item.id, mark, note }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Не удалось изменить балл."); return false; }
      setWork(w => w ? { ...w, ...data } : w);
      onChanged();
      return true;
    } catch (e) { setError("Нет связи с сервером."); return false; }
    finally { setBusy(null); }
  };

  const complete = async () => {
    if (!confirm("Отметить работу как проверенную?\n\nВаше имя будет записано как проверяющего.")) return;
    setBusy("complete");
    try {
      const res = await fetch("/api/placement/review/complete", {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ tenantId, resultId }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Не удалось сохранить."); return; }
      onChanged();
      onClose();
    } catch (e) { setError("Нет связи с сервером."); }
    finally { setBusy(null); }
  };

  if (loading) {
    return <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center text-white">Загрузка работы…</div>;
  }
  if (!work) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <p className="text-red-700 mb-4">{error || "Работа не найдена."}</p>
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold">Закрыть</button>
        </div>
      </div>
    );
  }

  const section = work.sections[sectionIdx];
  const items = (section?.items || []).filter(i => !onlyWrong || i.mark < 1);
  const reviewed = work.reviewStatus === "reviewed";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full my-4" onClick={e => e.stopPropagation()}>

        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">{work.studentName}</h2>
            <p className="text-xs text-slate-500">
              {work.grade} класс · работа <span className="font-mono">{work.shortId}</span>
              {reviewed && <span className="ml-2 text-emerald-600 font-semibold">проверена · {work.reviewedBy}</span>}
              {work.published && <span className="ml-2 text-blue-600 font-semibold">опубликована</span>}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold tabular-nums">{work.correct} / {work.total}</div>
            <div className="text-xs text-slate-500">
              {work.percent}%{work.satMath != null && <> · SAT {work.satMath}</>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 text-2xl leading-none shrink-0">×</button>
        </div>

        {error && <div className="mx-5 mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>}
        {work.published && (
          <div className="mx-5 mt-3 rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
            Результаты опубликованы — баллы больше не правятся. Работа доступна только для просмотра.
          </div>
        )}

        <div className="px-5 py-3 flex items-center gap-2 flex-wrap border-b border-slate-100">
          {work.sections.map((s, i) => (
            <button key={s.key} onClick={() => { setSectionIdx(i); setOpenId(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                i === sectionIdx ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {s.title} <span className="font-mono">{s.correct}/{s.total}</span>
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={onlyWrong} onChange={e => setOnlyWrong(e.target.checked)} />
            только спорные
          </label>
        </div>

        <div className="px-5 py-4 grid gap-1.5">
          {items.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-6">
              {onlyWrong ? "Все вопросы этой секции засчитаны полностью." : "В секции нет вопросов."}
            </p>
          )}
          {items.map(it => {
            const idx = (section.items || []).indexOf(it) + 1;
            const open = openId === it.id;
            const goNext = () => {
              const all = section.items || [];
              const pos = all.indexOf(it);
              const next = all.slice(pos + 1).find(x => !onlyWrong || x.mark < 1);
              setOpenId(next ? next.id : null);
            };

            return (
              <div key={it.id} className={`border rounded-xl transition ${
                open ? "border-blue-400 shadow-sm"
                : it.overridden ? "border-blue-200 bg-blue-50/30"
                : it.mark === 1 ? "border-slate-200"
                : "border-amber-200 bg-amber-50/20"}`}>

                {/* Свёрнутая строка: номер, вердикт, балл — по ней и кликают */}
                <button onClick={() => setOpenId(open ? null : it.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                  <span className="font-mono font-bold text-slate-500 w-8 shrink-0">№{idx}</span>
                  <span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                    it.mark === 1 ? "bg-emerald-100 text-emerald-700"
                    : it.mark === 0.5 ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"}`}>
                    {it.mark === 0.5 ? "½" : it.mark}
                  </span>
                  <span className="text-sm text-slate-700 truncate flex-1">{it.text}</span>
                  <span className="text-xs text-slate-400 shrink-0 hidden sm:inline">
                    {DIFF[it.difficulty] || ""}
                  </span>
                  {it.overridden && <span className="text-xs text-blue-600 font-semibold shrink-0">правка</span>}
                  <span className="text-slate-400 shrink-0">{open ? "▲" : "▼"}</span>
                </button>

                {/* Раскрытое задание — только для текущего вопроса */}
                {open && (
                  <div className="px-3 pb-3 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2 text-xs mb-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${
                        it.difficulty === 1 ? "bg-emerald-50 text-emerald-700"
                        : it.difficulty === 2 ? "bg-amber-50 text-amber-700"
                        : "bg-red-50 text-red-700"}`}>
                        {DIFF[it.difficulty] || "—"}
                      </span>
                      {it.topic && <span className="text-slate-500">{it.topic}</span>}
                      <span className="text-slate-400 ml-auto">
                        машина: {it.autoCorrect ? "верно" : "неверно"}
                      </span>
                    </div>

                    <p className="text-sm text-slate-900 mb-3 leading-snug">{it.text}</p>

                    <div className="grid gap-1 mb-3 text-sm">
                      {it.type === "text_input" ? (
                        <>
                          <div>Ответ ученика: <b className={it.autoCorrect ? "text-emerald-700" : "text-red-700"}>
                            {it.given || "— не отвечено"}</b></div>
                          <div className="text-slate-500">Верный ответ: <b className="text-slate-700">{it.answer}</b></div>
                        </>
                      ) : (
                        it.options.map((o, i) => {
                          const letter = LETTERS[i];
                          const chosen = it.given === letter;
                          const right = it.answer === letter;
                          return (
                            <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded ${
                              right ? "bg-emerald-50" : chosen ? "bg-red-50" : ""}`}>
                              <span className={`w-5 h-5 rounded-full grid place-items-center text-xs font-bold border shrink-0 ${
                                right ? "border-emerald-500 text-emerald-700"
                                : chosen ? "border-red-400 text-red-600" : "border-slate-300 text-slate-400"}`}>
                                {letter}
                              </span>
                              <span className={right ? "text-emerald-800" : chosen ? "text-red-700" : "text-slate-600"}>
                                {o.replace(/^[А-ЯA-Z][).]\s*/, "")}
                              </span>
                              {chosen && <span className="text-xs text-slate-500 ml-1">← ученик</span>}
                              {right && <span className="text-xs text-emerald-600 ml-auto shrink-0">верный</span>}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {it.overrideNote && (
                      <p className="text-xs text-slate-500 mb-2">Основание: {it.overrideNote}</p>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-slate-500 mr-1">Балл:</span>
                      {[0, 0.5, 1].map(m => (
                        <button key={m} onClick={async () => {
                            const changed = await setMark(section.key, it, m);
                            // Выставил балл — сразу к следующему: учитель идёт
                            // по стопке черновиков, лишний клик на каждом
                            // вопросе это десятки кликов за класс.
                            if (changed) goNext();
                          }}
                          disabled={busy === it.id || work.published}
                          className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition ${
                            it.mark === m
                              ? m === 1 ? "bg-emerald-600 border-emerald-600 text-white"
                                : m === 0.5 ? "bg-amber-500 border-amber-500 text-white"
                                : "bg-red-600 border-red-600 text-white"
                              : "border-slate-300 text-slate-600 hover:border-slate-400"
                          } ${work.published ? "opacity-50 cursor-not-allowed" : ""}`}>
                          {m === 0.5 ? "½" : m}
                        </button>
                      ))}
                      <button onClick={goNext}
                        className="ml-auto px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 text-slate-600 hover:bg-slate-50">
                        Следующий →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex items-center gap-3 flex-wrap sticky bottom-0 bg-white rounded-b-2xl">
          {!reviewed && !work.published && (
            <button onClick={complete} disabled={busy === "complete"}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50">
              {busy === "complete" ? "Сохраняем…" : "✓ Работа проверена"}
            </button>
          )}
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm">
            Закрыть
          </button>
          <span className="ml-auto text-xs text-slate-400">
            Итог пересчитывается сразу после каждой правки
          </span>
        </div>
      </div>
    </div>
  );
}
