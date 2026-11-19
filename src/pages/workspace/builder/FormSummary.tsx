import React, { useMemo, useState } from "react";
import { ChevronRight, Filter, X } from "lucide-react";
import { summarize, type FieldSummary, type SummaryBar } from "../../../shared/formSummary";
import type { FormFieldDef } from "../../../shared/formFields";

/**
 * Сводка ответов формы — как «Ответы → Сводка» в Google Forms. Один вариант —
 * цветное кольцо с легендой; несколько вариантов, числа и даты — полосы;
 * тексты — списком. Считается по отобранным заявкам. Клик по варианту — окно
 * «кто так ответил»; клик по человеку или по тексту ответа — его заявка целиком.
 *
 * Цвета колец — проверенная палитра (--series-1…8, своя для тёмной темы),
 * в фиксированном порядке вариантов формы. Больше 8 вариантов — полосы.
 */
const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);
const fmt = (n: number) => String(n).replace(".", ",");
const card = "bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 space-y-3";

/** Кто стоит за вариантом: заголовок, заявки и (если вариант можно отобрать) фильтр. */
export interface WhoList { title: string; ids: string[]; filter?: () => void }

export default function FormSummary({ fields, subs, onPick, onWho, onOpen }: {
  fields: FormFieldDef[]; subs: any[]; onPick: (fieldId: string, value: string) => void;
  onWho: (w: WhoList) => void; onOpen: (id: string) => void;
}) {
  const data = useMemo(() => summarize(fields, subs), [fields, subs]);
  const names = useMemo(() => new Map(subs.map(x => [x.id, String(x.applicantName || "").trim()])), [subs]);
  const nameOf = (id: string) => names.get(id) || "";
  if (!data.total) return <div className={`${card} text-center text-xs text-[var(--text-muted)] py-12`}>Под условия не подошёл ни один ответ.</div>;
  const peak = Math.max(1, ...data.byDay.map(d => d.count));
  return (
    <div className="space-y-3">
      <div className={card}>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-3xl font-black text-[var(--text-main)] tabular-nums">{data.total}</div>
            <div className="text-[11px] text-[var(--text-muted)]">ответов</div>
          </div>
          {data.byDay.length > 1 && (
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-end gap-[2px] h-14">
                {data.byDay.map(d => (
                  <div key={d.day} title={`${new Date(`${d.day}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} — ${d.count}`}
                    className="flex-1 rounded-t-[3px] bg-[var(--series-1)] hover:opacity-80 min-h-[2px]" style={{ height: `${Math.max(3, (d.count / peak) * 100)}%`, opacity: d.count ? 1 : 0.25 }} />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                <span>{new Date(`${data.byDay[0].day}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
                <span>ответы по дням</span>
                <span>{new Date(`${data.byDay[data.byDay.length - 1].day}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {data.fields.map(s => (
        <FieldCard key={s.field.id} s={s} onOpen={onOpen} nameOf={nameOf}
          onWho={(b: SummaryBar) => onWho({ title: `${s.field.label} — ${b.label}`, ids: b.ids || [], filter: b.value ? () => onPick(s.field.id, b.value) : undefined })} />
      ))}
    </div>
  );
}

function FieldCard({ s, onWho, onOpen, nameOf }: { s: FieldSummary; onWho: (b: SummaryBar) => void; onOpen: (id: string) => void; nameOf: (id: string) => string }) {
  const f = s.field;
  const sub = [
    `${s.answered} ${plural(s.answered, "ответ", "ответа", "ответов")}`,
    s.field.showIf ? `вопрос видели ${s.shown}` : "",
    s.kind === "multi" ? "можно выбрать несколько" : "",
  ].filter(Boolean).join(" · ");
  return (
    <div className={card}>
      <div>
        <div className="font-semibold text-sm text-[var(--text-main)]">{f.label}</div>
        <div className="text-[11px] text-[var(--text-muted)]">{sub}</div>
      </div>
      {(s.kind === "choice") && s.bars!.length >= 2 && s.bars!.length <= 8 ? <Ring bars={s.bars!} onPick={onWho} />
        : s.kind === "choice" || s.kind === "multi" || s.kind === "check" ? <Bars bars={s.bars!} onPick={onWho} />
        : s.kind === "number" ? (
          s.stats ? <>
            <div className="flex gap-6 text-xs">{([["мин", s.stats.min], ["среднее", s.stats.avg], ["макс", s.stats.max]] as const).map(([l, v]) => <div key={l}><div className="text-lg font-bold text-[var(--text-main)] tabular-nums">{fmt(v)}</div><div className="text-[var(--text-muted)]">{l}</div></div>)}</div>
            <Bars onPick={onWho} bars={(s.buckets || []).map(b => ({ value: "", label: b.label, count: b.count, ids: b.ids, pct: Math.round((b.count / Math.max(1, s.answered)) * 1000) / 10 }))} />
          </> : <Empty />
        ) : s.kind === "date" ? (
          s.dates ? <>
            <div className="text-xs text-[var(--text-main)]">с {new Date(s.dates.first).toLocaleDateString("ru-RU")} по {new Date(s.dates.last).toLocaleDateString("ru-RU")}</div>
            <Bars onPick={onWho} bars={(s.buckets || []).map(b => ({ value: "", label: new Date(`${b.label}-01`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" }), count: b.count, ids: b.ids, pct: Math.round((b.count / Math.max(1, s.answered)) * 1000) / 10 }))} />
          </> : <Empty />
        ) : s.kind === "file" ? <div className="text-xs text-[var(--text-muted)]">Файл приложили: {s.answered}</div>
        : <Texts s={s} onOpen={onOpen} onWho={onWho} nameOf={nameOf} />}
      {s.others && s.others.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-[var(--accent)]">Что вписали в «Другое» · {s.others.length}</summary>
          <ul className="mt-1.5 space-y-1 text-[var(--text-main)]">{s.others.map((t, i) => <li key={i}><Answer text={t.text} who={nameOf(t.id)} onClick={() => onOpen(t.id)} /></li>)}</ul>
        </details>
      )}
    </div>
  );
}

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const Empty = () => <div className="text-xs text-[var(--text-muted)]">Пока нет ответов</div>;

/** Кольцо: доли одного выбора; 2px разрывы между долями; легенда с числом и процентом. */
function Ring({ bars, onPick }: { bars: SummaryBar[]; onPick: (b: SummaryBar) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = bars.reduce((n, b) => n + b.count, 0);
  const R = 52, W = 22, C = 2 * Math.PI * R, gap = total && bars.filter(b => b.count).length > 1 ? 2 : 0;
  let acc = 0;
  const h = hover !== null ? bars[hover] : null;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="w-36 h-36 shrink-0 -rotate-90" role="img" aria-label={bars.map(b => `${b.label}: ${b.count}`).join(", ")}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--bg-surface-hover)" strokeWidth={W} />
        {bars.map((b, i) => {
          const len = total ? (b.count / total) * C : 0;
          const seg = Math.max(0, len - gap);
          const el = b.count ? (
            <circle key={i} cx="70" cy="70" r={R} fill="none" stroke={SERIES[i]} strokeWidth={hover === i ? W + 4 : W}
              strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={-acc} className="cursor-pointer transition-[stroke-width] duration-150"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onPick(b)}>
              <title>{`${b.label} — ${b.count} (${fmt(b.pct)}%)`}</title>
            </circle>
          ) : null;
          acc += len;
          return el;
        })}
        <g className="rotate-90 origin-center pointer-events-none">
          <text x="70" y="66" textAnchor="middle" className="fill-[var(--text-main)] text-[20px] font-bold tabular-nums">{h ? `${fmt(h.pct)}%` : total}</text>
          <text x="70" y="84" textAnchor="middle" className="fill-[var(--text-muted)] text-[10px]">{h ? `${h.count} из ${total}` : "ответов"}</text>
        </g>
      </svg>
      <ul className="flex-1 min-w-[200px] max-w-lg space-y-1">
        {bars.map((b, i) => (
          <li key={i}>
            <button type="button" disabled={!b.count} onClick={() => onPick(b)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              className={`w-full flex items-center gap-2 text-left text-xs rounded-lg px-2 py-1 hover:bg-[var(--bg-surface-hover)] ${hover === i ? "bg-[var(--bg-surface-hover)]" : ""}`}>
              <span className="w-3 h-3 rounded-[3px] shrink-0" style={{ background: SERIES[i] }} />
              <span className="flex-1 min-w-0 text-[var(--text-main)]">{b.label}</span>
              <span className="tabular-nums text-[var(--text-main)] font-semibold">{b.count}</span>
              <span className="tabular-nums text-[var(--text-muted)] w-12 text-right">{fmt(b.pct)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Полосы: один цвет, подпись и число всегда видны; клик — кто так ответил. */
function Bars({ bars, onPick }: { bars: SummaryBar[]; onPick?: (b: SummaryBar) => void }) {
  const max = Math.max(1, ...bars.map(b => b.count));
  return (
    <ul className="space-y-1.5">
      {bars.map((b, i) => {
        const click = onPick && b.count && b.ids?.length ? () => onPick(b) : undefined;
        return (
          <li key={i}>
            <button type="button" disabled={!click} onClick={click} title={`${b.label} — ${b.count} (${fmt(b.pct)}%)`}
              className="w-full text-left rounded-lg px-1.5 py-1 enabled:hover:bg-[var(--bg-surface-hover)] disabled:cursor-default">
              <div className="flex items-baseline gap-2 text-xs">
                <span className="flex-1 min-w-0 text-[var(--text-main)]">{b.label}</span>
                <span className="tabular-nums font-semibold text-[var(--text-main)]">{b.count}</span>
                <span className="tabular-nums text-[var(--text-muted)] w-12 text-right">{fmt(b.pct)}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-[var(--bg-surface-hover)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${(b.count / max) * 100}%` }} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Текст ответа и кто его написал — кнопка: открывает заявку этого человека. */
const Answer = ({ text, who, onClick }: { text: string; who?: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} title={who ? `Открыть заявку: ${who}` : "Открыть заявку"}
    className="group w-full flex items-start gap-2 text-left px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-hover)] hover:ring-1 hover:ring-[var(--accent)] transition">
    <span className="flex-1 min-w-0">
      <span className="block whitespace-pre-line">{text}</span>
      {who && <span className="block mt-0.5 text-[10px] text-[var(--text-muted)] group-hover:text-[var(--accent)] truncate">{who}</span>}
    </span>
    <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--text-muted)] group-hover:text-[var(--accent)]" />
  </button>
);

function Texts({ s, onOpen, onWho, nameOf }: { s: FieldSummary; onOpen: (id: string) => void; onWho: (b: SummaryBar) => void; nameOf: (id: string) => string }) {
  const [all, setAll] = useState(false);
  const list = s.texts || [];
  if (!list.length) return <Empty />;
  return (
    <div className="space-y-2">
      {!!s.top?.length && (
        <div className="flex flex-wrap gap-1.5">{s.top.map(t => <button type="button" key={t.text} onClick={() => onWho({ value: "", label: t.text, count: t.count, pct: 0, ids: t.ids })} className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--bg-surface-hover)] text-[var(--text-main)] hover:ring-1 hover:ring-[var(--accent)]">{t.text} · {t.count}</button>)}</div>
      )}
      <ul className="space-y-1 text-xs text-[var(--text-main)]">
        {(all ? list : list.slice(0, 10)).map((t, i) => <li key={i}><Answer text={t.text} who={nameOf(t.id)} onClick={() => onOpen(t.id)} /></li>)}
      </ul>
      {list.length > 10 && <button type="button" className="text-xs text-[var(--accent)] hover:underline" onClick={() => setAll(v => !v)}>{all ? "Свернуть" : `Показать все ${list.length}`}</button>}
    </div>
  );
}

/** Окно «кто так ответил»: список людей; клик — их заявка целиком (окно поверх, страница та же). */
export function WhoModal({ who, subs, onOpen, onClose }: { who: WhoList; subs: any[]; onOpen: (id: string) => void; onClose: () => void }) {
  const byId = new Map(subs.map(x => [x.id, x]));
  const people = who.ids.map(id => byId.get(id)).filter(Boolean);
  const when = (x: any) => (x.createdAt?.seconds ? new Date(x.createdAt.seconds * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "");
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-4 border-b border-[var(--border-color)]">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-[var(--text-main)]">{who.title}</div>
            <div className="text-[11px] text-[var(--text-muted)]">{people.length} {plural(people.length, "человек", "человека", "человек")}</div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)]" aria-label="Закрыть"><X className="w-5 h-5" /></button>
        </div>
        <ul className="overflow-y-auto p-2 space-y-1">
          {people.map((x: any) => (
            <li key={x.id}>
              <button type="button" onClick={() => onOpen(x.id)}
                className="group w-full flex items-center gap-3 text-left px-3 py-2 rounded-xl hover:bg-[var(--bg-surface-hover)] transition">
                <span className="w-8 h-8 shrink-0 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] grid place-items-center text-sm font-bold">{String(x.applicantName || "?")[0].toUpperCase()}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-[var(--text-main)] truncate">{x.applicantName || "Без имени"}</span>
                  <span className="block text-[11px] text-[var(--text-muted)] truncate">{[x.applicantPhone || x.applicantEmail, when(x)].filter(Boolean).join(" · ")}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)]" />
              </button>
            </li>
          ))}
          {!people.length && <li className="p-6 text-center text-xs text-[var(--text-muted)]">Никого</li>}
        </ul>
        {who.filter && people.length > 0 && (
          <div className="p-3 border-t border-[var(--border-color)]">
            <button type="button" onClick={who.filter} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]">
              <Filter className="w-4 h-4" /> Показать их в списке
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
