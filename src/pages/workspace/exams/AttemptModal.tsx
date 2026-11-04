import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Award, Ban, CheckCircle2, RefreshCw, Eye, EyeOff, FileText, Loader2, RotateCcw, ShieldAlert, Square, Trash2, Undo2 } from "lucide-react";
import DOMPurify from "dompurify";
import ProctoringDossier from "../../../components/ProctoringDossier";
import { TYPE_LABEL, plainText } from "../../../shared/exams";
import { DECISION_LABEL, partResults, type Attempt, type Decision, type Exam, type FrozenQuestion } from "../../../shared/examRun";
import { certificateHTML, openPrint, reportHTML, type PrintData } from "../../../lib/examPrint";
import { tenantLogos, resolveLegalProfile } from "../../../shared/legal";
import { Modal, btn, btnPrimary, input, label } from "../journals/components/ui";
import type { Api } from "./examApi";

type Full = Attempt & { questions: Record<string, FrozenQuestion> };

/** Карточка работы: ответы и ручная проверка, прокторинг, решения. */
export default function AttemptModal({ attemptId, exam, api, tenant, canEdit, onChanged, onClose }: {
  attemptId: string; exam: Exam; api: Api; tenant: any; canEdit: boolean; onChanged: () => void; onClose: () => void;
}) {
  const [a, setA] = useState<Full | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [dossier, setDossier] = useState(false);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    try { const j = await api(`/attempts/${attemptId}`); setA(j.attempt); setComment(j.attempt.decision?.comment || ""); }
    catch (e: any) { setError(e.message); }
  }, [api, attemptId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (a?.hasPhoto) api(`/attempts/${attemptId}/photo`).then(j => setPhoto(j.photo)).catch(() => {}); }, [a?.hasPhoto, api, attemptId]);

  const act = async (action: string, extra: Record<string, unknown> = {}, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(action); setError(null);
    try {
      const j = await api(`/attempts/${attemptId}/action`, { method: "POST", body: JSON.stringify({ action, ...extra }) });
      onChanged();
      if (j.deleted) { onClose(); return; }
      if (j.recheck) alert(j.recheck.keys ? `Перепроверено по новым ключам: изменились ${j.recheck.keys} вопр. Было ${j.recheck.before}%, стало ${j.recheck.after}%.` : `Ключи не менялись — результат прежний: ${j.recheck.after}%.`);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };
  const review = async (overrides: Record<string, number | null>, notes: Record<string, string> = {}, complete = false) => {
    setBusy("review"); setError(null);
    try { await api(`/attempts/${attemptId}/review`, { method: "POST", body: JSON.stringify({ overrides, notes, complete }) }); await load(); onChanged(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  const printData = useMemo((): PrintData | null => {
    if (!a?.result) return null;
    const legal = resolveLegalProfile(tenant);
    return {
      title: exam.settings.results.certificateTitle, examTitle: exam.title,
      student: { name: a.student.name, level: a.student.level ? `${exam.settings.registration.levelLabel}: ${a.student.level}` : "", shortId: a.shortId },
      orgName: tenant?.name || "", logoUrl: tenantLogos(tenant).logoUrl,
      school: { legalName: legal.legalName, signatoryTitle: legal.signatoryTitle, signatoryName: legal.signatoryName, stampUrl: legal.stampUrl || null },
      photo,
      result: { ...a.result, parts: partResults(a.result.sections, exam.settings.scoring), hideTotal: !!exam.settings.scoring.parts?.length && !!exam.settings.scoring.hideTotal, group: exam.settings.results.groups.length ? a.group : null, decision: exam.settings.results.decisions && a.decision ? DECISION_LABEL[a.decision.value] : null, finishedAt: a.finishedAt },
    };
  }, [a, exam, tenant, photo]);

  if (!a) return <Modal title="Работа" onClose={onClose} xwide>{error ? <div className="text-rose-600 text-sm">{error}</div> : <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>}</Modal>;

  const r = a.result;
  const items = new Map((r?.items || []).map(i => [i.qid, i]));
  const s = exam.settings;
  const parts = r ? partResults(r.sections, s.scoring) : [];
  const hideTotal = parts.length > 0 && !!s.scoring.hideTotal;
  const pr = a.proctoring || { enabled: false };

  return (
    <Modal title={`${a.student.name} · № ${a.shortId}`} onClose={onClose} xwide>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-start">
          {photo && <img src={photo} alt="" className="w-20 h-24 object-cover rounded-lg border border-[var(--border-color)]" />}
          <div className="flex-1 min-w-[220px] text-sm space-y-0.5">
            <div className="text-[var(--text-muted)]">{[a.student.level && `${s.registration.levelLabel}: ${a.student.level}`, a.student.phone, a.student.email].filter(Boolean).join(" · ")}</div>
            <div className="text-[var(--text-muted)]">Начал {new Date(a.startedAt).toLocaleString("ru-RU")}{a.finishedAt ? ` · сдал ${new Date(a.finishedAt).toLocaleString("ru-RU")} (${Math.round((a.finishedAt - a.startedAt) / 60000)} мин)` : ""}</div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {a.status === "in_progress" && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">Сдаёт: {a.sections[a.current]?.title}</span>}
              {a.status === "annulled" && <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600">Аннулирована</span>}
              {a.superseded && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/10 text-[var(--text-muted)]">Заменена пересдачей</span>}
              {a.review?.status === "done" && <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700">Проверено</span>}
              {a.published && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700">Опубликовано</span>}
              {a.retakeAllowed && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700">Пересдача разрешена</span>}
            </div>
          </div>
          {r && (
            <div className="flex gap-2 flex-wrap">
              {parts.map(p => <Stat key={p.id} t={p.title} v={p.value} sub={p.kind === "points" ? `${fmt(p.percent)}%` : `${fmt(p.earned)} / ${fmt(p.max)}`} />)}
              {!hideTotal && <>
              <Stat t="Результат" v={`${fmt(r.percent)}%`} sub={`${fmt(r.earned)} / ${fmt(r.max)}`} />
              {r.mark != null && <Stat t="Отметка" v={String(r.mark)} />}
              {r.band != null && <Stat t="Балл 1–5" v={r.band.toFixed(1).replace(".", ",")} />}
              {r.scaleLabel && <Stat t="Уровень" v={r.scaleLabel} />}
              </>}
            </div>
          )}
        </div>

        {r && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {r.sections.map(x => (
              <div key={x.id} className="rounded-lg border border-[var(--border-color)] p-2.5">
                <div className="text-xs text-[var(--text-muted)] truncate">{x.title}</div>
                <div className="font-bold text-[var(--text-main)]">{x.percent}% <span className="text-xs font-normal text-[var(--text-muted)]">{x.earned}/{x.max}</span></div>
              </div>
            ))}
          </div>
        )}

        {/* Действия */}
        {canEdit && (
          <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)]">
            {a.status === "finished" && (a.published
              ? <button className={btn} disabled={!!busy} onClick={() => act("unpublish")}><EyeOff className="w-4 h-4" /> Снять публикацию</button>
              : <button className={btnPrimary} disabled={!!busy} onClick={() => act("publish")}><Eye className="w-4 h-4" /> Опубликовать</button>)}
            {r && s.results.certificate && printData && <button className={btn} onClick={() => openPrint(certificateHTML(printData)) || alert("Разрешите всплывающие окна")}><Award className="w-4 h-4" /> Сертификат</button>}
            {r && printData && <button className={btn} onClick={() => openPrint(reportHTML(printData)) || alert("Разрешите всплывающие окна")}><FileText className="w-4 h-4" /> Отчёт по темам</button>}
            {pr.enabled && <button className={btn} onClick={() => setDossier(true)}><ShieldAlert className="w-4 h-4" /> Досье прокторинга</button>}
            {a.status === "in_progress" && <button className={btn} disabled={!!busy} onClick={() => act("finish", {}, "Завершить работу сейчас и посчитать результат?")}><Square className="w-4 h-4" /> Завершить сейчас</button>}
            {a.status === "finished" && <button className={btn} disabled={!!busy} onClick={() => act("recheck")}>{busy === "recheck" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Перепроверить</button>}
            {!a.retakeAllowed && a.status === "finished" && !a.superseded && <button className={btn} disabled={!!busy} onClick={() => act("allow_retake", {}, "Разрешить ещё одну попытку? Новая сданная работа заменит эту.")}><RotateCcw className="w-4 h-4" /> Разрешить пересдачу</button>}
            {a.status !== "annulled"
              ? <button className={`${btn} text-rose-600`} disabled={!!busy} onClick={() => { const reason = prompt("Причина аннулирования (увидят менеджеры):"); if (reason !== null) void act("annul", { reason }); }}><Ban className="w-4 h-4" /> Аннулировать</button>
              : <button className={btn} disabled={!!busy} onClick={() => act("restore")}><Undo2 className="w-4 h-4" /> Восстановить</button>}
            <button className={`${btn} text-rose-600 ml-auto`} disabled={!!busy} onClick={() => act("delete", {}, "Удалить работу насовсем вместе с фото и снимками?")}><Trash2 className="w-4 h-4" /></button>
          </div>
        )}

        {canEdit && a.status === "finished" && (s.results.decisions || s.results.groups.length > 0) && (
          <div className="grid sm:grid-cols-2 gap-3">
            {s.results.decisions && (
              <div>
                <span className={label}>Решение</span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(DECISION_LABEL) as Decision[]).map(d => (
                    <button key={d} disabled={!!busy} className={`${btn} ${a.decision?.value === d ? "!bg-[var(--accent)] !text-white !border-[var(--accent)]" : ""}`} onClick={() => act("decision", { value: a.decision?.value === d ? null : d, comment })}>{DECISION_LABEL[d]}</button>
                  ))}
                </div>
                <input className={`${input} mt-2`} value={comment} onChange={e => setComment(e.target.value)} onBlur={() => a.decision && comment !== a.decision.comment && act("decision", { value: a.decision.value, comment })} placeholder="Комментарий к решению" />
                {a.decision && <div className="text-[11px] text-[var(--text-muted)] mt-1">{a.decision.by} · {new Date(a.decision.at).toLocaleString("ru-RU")}</div>}
              </div>
            )}
            {s.results.groups.length > 0 && (
              <div>
                <span className={label}>Группа</span>
                <select className={input} value={a.group || ""} onChange={e => act("group", { value: e.target.value })}>
                  <option value="">— не распределён —</option>
                  {s.results.groups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {error && <div className="text-sm text-rose-600">{error}</div>}

        {/* Ответы и проверка */}
        {a.status !== "in_progress" && r && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-[var(--text-main)]">Ответы</h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyWrong} onChange={e => setOnlyWrong(e.target.checked)} /> Только неверные</label>
                {canEdit && a.review?.status !== "done" && <button className={btnPrimary} disabled={!!busy} onClick={() => review({}, {}, true)}><CheckCircle2 className="w-4 h-4" /> Проверка завершена</button>}
              </div>
            </div>
            {a.sections.flatMap(s => (s.blocks?.length ? s.blocks : [s])).map(sec => (
              <div key={sec.id}>
                <div className="text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1.5">{sec.title}</div>
                <ol className="space-y-2">
                  {sec.questionIds.map((qid, idx) => {
                    const q = a.questions[qid]; const it = items.get(qid);
                    if (!q || !it || (onlyWrong && it.correct)) return null;
                    const tone = it.correct ? "border-emerald-500/40" : it.earned > 0 ? "border-amber-500/40" : "border-rose-500/40";
                    return (
                      <li key={qid} className={`rounded-lg border-l-4 border border-[var(--border-color)] ${tone} p-3`}>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                          <span className="font-mono font-bold text-[var(--text-main)]">{idx + 1}. {qid}</span>
                          <span>{TYPE_LABEL[q.type]}</span>{q.topic && <span>· {q.topic}</span>}
                          {it.overridden && <span className="text-amber-700">· оценено вручную</span>}
                        </div>
                        {q.html ? <div className="text-sm text-[var(--text-main)] mt-1 [&_img]:max-h-40" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(q.html) }} />
                          : <div className="text-sm text-[var(--text-main)] mt-1 whitespace-pre-line">{plainText(q as any)}</div>}
                        <div className="grid sm:grid-cols-2 gap-x-4 text-sm mt-1.5">
                          <div><span className="text-[var(--text-muted)]">Ответ: </span><b className={it.correct ? "text-emerald-700" : "text-rose-600"}>{it.answer || "— нет ответа —"}</b></div>
                          <div><span className="text-[var(--text-muted)]">Ключ: </span>{q.answer}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-xs text-[var(--text-muted)]">Баллы: <b className="text-[var(--text-main)]">{it.earned}</b> из {it.points}</span>
                          {canEdit && [0, q.points / 2, q.points].map(v => (
                            <button key={v} disabled={!!busy} onClick={() => review({ [qid]: v })}
                              className={`px-2 py-0.5 rounded border text-xs ${it.overridden && it.earned === v ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--border-color)]"}`}>{v === 0 ? "0" : v === q.points ? "полный" : "½"}</button>
                          ))}
                          {canEdit && it.overridden && <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => review({ [qid]: null })}>как в автопроверке ({it.auto})</button>}
                          {canEdit && <NoteInput value={a.review?.notes?.[qid] || ""} onSave={v => review({}, { [qid]: v })} />}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </div>
      {dossier && (
        <ProctoringDossier shortId={a.shortId} studentName={a.student.name} grade={a.student.level}
          report={{ ...pr, violations: pr.violations || [] } as any}
          loadSnapshots={async () => (await api(`/attempts/${attemptId}/evidence`)).snapshots}
          onClose={() => setDossier(false)} />
      )}
    </Modal>
  );
}

const fmt = (n: number) => Number(n).toLocaleString("ru-RU", { maximumFractionDigits: 1 });

function Stat({ t, v, sub }: { t: string; v: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-center min-w-[84px]">
      <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">{t}</div>
      <div className="text-lg font-bold text-[var(--text-main)] leading-tight">{v}</div>
      {sub && <div className="text-[11px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

function NoteInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input className={`${input} !py-1 !text-xs flex-1 min-w-[160px]`} value={v} onChange={e => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} placeholder="Заметка проверяющего" />;
}
