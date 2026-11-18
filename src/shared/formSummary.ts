import { OTHER, visibleFields, type FormFieldDef } from "./formFields";

/**
 * Сводка ответов формы — как «Ответы → Сводка» в Google Forms: по каждому
 * вопросу варианты с долями, числа, даты или список текстов. Считается по
 * тем заявкам, что сейчас отобраны (фильтры, статус, поиск).
 *
 * Условный вопрос (showIf) считается только по тем, кому он показывался:
 * иначе доля «оргкоманды» делилась бы и на 7-классников, которым вопрос
 * не задавали.
 */
export interface SummaryBar { value: string; label: string; count: number; pct: number }
export interface FieldSummary {
  field: FormFieldDef;
  kind: "choice" | "multi" | "check" | "number" | "date" | "text" | "file";
  /** Скольким заявкам вопрос показывался. */
  shown: number;
  /** Сколько ответили. */
  answered: number;
  bars?: SummaryBar[];
  /** Тексты «Другое: …». */
  others?: string[];
  stats?: { min: number; max: number; avg: number };
  buckets?: { label: string; count: number }[];
  dates?: { first: string; last: string };
  /** Ответы-тексты: новые сверху. */
  texts?: string[];
  /** Повторяющиеся ответы (если такие есть). */
  top?: { text: string; count: number }[];
}
export interface FormSummaryData { total: number; byDay: { day: string; count: number }[]; fields: FieldSummary[] }

type Sub = { data?: Record<string, unknown>; createdAt?: { seconds?: number } | null };
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 1000) / 10 : 0);
const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "boolean" ? true : String(v ?? "").trim() !== "");
const ms = (s: Sub) => (s.createdAt?.seconds ? s.createdAt.seconds * 1000 : 0);
const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function summarize(fields: FormFieldDef[], subs: Sub[]): FormSummaryData {
  const list = [...subs].sort((a, b) => ms(b) - ms(a));
  // Какие поля видела каждая заявка — по её же ответам.
  const seen = list.map(s => new Set(visibleFields(fields, s.data || {}).map(f => f.id)));
  const out: FieldSummary[] = [];
  for (const f of fields) {
    if (f.type === "section") continue;
    const rows = list.map((s, i) => ({ v: s.data?.[f.id], shown: seen[i].has(f.id) })).filter(r => r.shown);
    const answered = rows.filter(r => filled(r.v)).length;
    const base = { field: f, shown: rows.length, answered };

    if (f.type === "select" || f.type === "radio") {
      const counts = new Map<string, number>();
      for (const r of rows) if (filled(r.v)) counts.set(String(r.v), (counts.get(String(r.v)) || 0) + 1);
      const order = [...(f.options || []), ...[...counts.keys()].filter(k => !(f.options || []).includes(k))];
      const bars = order.map(o => ({ value: o, label: o, count: counts.get(o) || 0, pct: pct(counts.get(o) || 0, answered) }));
      out.push({ ...base, kind: "choice", bars });
    } else if (f.type === "multi") {
      const counts = new Map<string, number>(); const others: string[] = [];
      for (const r of rows) {
        const arr = Array.isArray(r.v) ? r.v.map(String) : [];
        let other = false;
        for (const x of new Set(arr)) {
          if (x === OTHER || x.startsWith(`${OTHER}:`)) { other = true; const t = x.slice(OTHER.length + 1).trim(); if (t) others.push(t); continue; }
          counts.set(x, (counts.get(x) || 0) + 1);
        }
        if (other) counts.set(OTHER, (counts.get(OTHER) || 0) + 1);
      }
      const opts = [...(f.options || []), ...(f.allowOther || counts.has(OTHER) ? [OTHER] : [])];
      const order = [...opts, ...[...counts.keys()].filter(k => !opts.includes(k))];
      const bars = order.map(o => ({ value: o, label: o, count: counts.get(o) || 0, pct: pct(counts.get(o) || 0, answered) }));
      out.push({ ...base, kind: "multi", bars, others });
    } else if (f.type === "checkbox") {
      const yes = rows.filter(r => r.v === true || String(r.v) === "true").length;
      out.push({ ...base, answered: rows.length, kind: "check", bars: [
        { value: "__true", label: "Отмечено", count: yes, pct: pct(yes, rows.length) },
        { value: "__false", label: "Не отмечено", count: rows.length - yes, pct: pct(rows.length - yes, rows.length) },
      ] });
    } else if (f.type === "number") {
      const nums = rows.map(r => Number(String(r.v ?? "").replace(",", "."))).filter((n, i) => filled(rows[i].v) && Number.isFinite(n));
      if (!nums.length) { out.push({ ...base, answered: 0, kind: "number" }); continue; }
      const min = Math.min(...nums), max = Math.max(...nums), avg = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
      const k = max > min ? 5 : 1, step = (max - min) / k || 1;
      const buckets = Array.from({ length: k }, (_, i) => {
        const lo = min + i * step, hi = i === k - 1 ? max : min + (i + 1) * step;
        const r = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
        return { label: k === 1 ? r(min) : `${r(lo)}–${r(hi)}`, count: nums.filter(n => (n >= lo && (n < hi || (i === k - 1 && n <= hi)))).length };
      });
      out.push({ ...base, answered: nums.length, kind: "number", stats: { min, max, avg }, buckets });
    } else if (f.type === "date") {
      const ds = rows.map(r => String(r.v ?? "")).filter(v => /^\d{4}-\d{2}-\d{2}/.test(v)).sort();
      const months = new Map<string, number>();
      for (const d of ds) months.set(d.slice(0, 7), (months.get(d.slice(0, 7)) || 0) + 1);
      out.push({ ...base, answered: ds.length, kind: "date", dates: ds.length ? { first: ds[0], last: ds[ds.length - 1] } : undefined,
        buckets: [...months].sort().map(([m, count]) => ({ label: m, count })) });
    } else if (f.type === "file") {
      out.push({ ...base, kind: "file" });
    } else {
      const texts = rows.map(r => String(r.v ?? "").trim()).filter(Boolean);
      const reps = new Map<string, { text: string; count: number }>();
      for (const t of texts) { const k = t.toLowerCase().replace(/\s+/g, " "); const e = reps.get(k); if (e) e.count++; else reps.set(k, { text: t, count: 1 }); }
      const top = [...reps.values()].filter(x => x.count > 1).sort((a, b) => b.count - a.count).slice(0, 5);
      out.push({ ...base, answered: texts.length, kind: "text", texts, top });
    }
  }
  // Ответы по дням — без пропусков между первым и последним днём (до двух месяцев).
  const days = new Map<string, number>();
  for (const s of list) if (ms(s)) days.set(dayKey(ms(s)), (days.get(dayKey(ms(s))) || 0) + 1);
  const keys = [...days.keys()].sort();
  const byDay: { day: string; count: number }[] = [];
  if (keys.length) {
    const start = new Date(`${keys[0]}T00:00:00`), end = new Date(`${keys[keys.length - 1]}T00:00:00`);
    const span = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    if (span <= 62) for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) byDay.push({ day: dayKey(d.getTime()), count: days.get(dayKey(d.getTime())) || 0 });
    else for (const k of keys) byDay.push({ day: k, count: days.get(k)! });
  }
  return { total: list.length, byDay, fields: out };
}
