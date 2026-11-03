import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, FileDown, Pause, Play, RotateCcw, Upload } from "lucide-react";
import { Modal, btn, btnPrimary } from "../journals/components/ui";
import { downloadTemplate } from "./bankSheets";

/**
 * Инструкция «Как загрузить много вопросов таблицей» — анимированный ролик.
 *
 * Не видеофайл, а нарисованные сцены: курсор сам показывает, куда нажимать,
 * строки таблицы «печатаются». Так ролик не устаревает вместе с интерфейсом
 * (сцены правятся здесь же), весит ноль и одинаково выглядит в тёмной теме.
 * Всё считается от времени сцены t — пауза, перемотка и шаги просто меняют t.
 */

type Key = { t: number; x: number; y: number; click?: boolean };
type Scene = { title: string; caption: string; duration: number; cursor?: Key[]; render: (t: number) => React.ReactNode };

const W = 640, H = 360;
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Плавное появление с момента from за ms. */
const fade = (t: number, from: number, ms = 300) => clamp01((t - from) / ms);

function cursorAt(keys: Key[], t: number) {
  let a = keys[0], b = keys[0];
  for (let i = 0; i < keys.length; i++) { if (keys[i].t <= t) { a = keys[i]; b = keys[i + 1] || keys[i]; } }
  const k = b.t > a.t ? ease(clamp01((t - a.t) / (b.t - a.t))) : 1;
  const click = keys.find(x => x.click && t >= x.t && t < x.t + 450);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, click: click ? (t - click.t) / 450 : null };
}
/** Набор текста: сколько символов видно к моменту t. */
const typed = (s: string, t: number, from: number, cps = 28) => s.slice(0, Math.max(0, Math.floor(((t - from) / 1000) * cps)));

// ── Детали макета ───────────────────────────────────────────────────────

const Btn = ({ x, y, w, children, primary, active }: { x: number; y: number; w: number; children: React.ReactNode; primary?: boolean; active?: boolean }) => (
  <div className={`absolute h-8 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${primary ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-300 text-slate-700"} ${active ? "ring-4 ring-blue-400/40 scale-[1.04]" : ""}`}
    style={{ left: x, top: y, width: w }}>{children}</div>
);
const Bar = ({ w, c = "bg-slate-200" }: { w: number | string; c?: string }) => <div className={`h-2 rounded ${c}`} style={{ width: w }} />;

function BankMock({ t, highlight }: { t: number; highlight?: boolean }) {
  return (
    <div className="absolute inset-0 bg-slate-100 p-3 flex gap-3">
      <div className="w-[170px] bg-white rounded-xl border border-slate-200 p-2 space-y-1.5">
        <div className="text-[9px] font-mono font-bold text-slate-400 px-1">ДИСЦИПЛИНЫ</div>
        {[["ENG", "Английский"], ["LOG", "Логика"], ["MAT", "Математика"], ["RUS", "Русский язык"]].map(([c, n], i) => (
          <div key={c} className={`rounded-lg px-2 py-1.5 flex items-center gap-1.5 ${i === 2 ? "bg-blue-600 text-white" : "text-slate-700"}`}>
            <span className={`text-[8px] font-mono font-bold px-1 rounded ${i === 2 ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{c}</span>
            <span className="text-[11px] font-medium">{n}</span>
          </div>
        ))}
        <div className="border-t border-slate-100 pt-2" />
      </div>
      <Btn x={24} y={190} w={150} active={highlight}><Upload className="w-3.5 h-3.5" /> Загрузить таблицу</Btn>
      <div className="flex-1 space-y-2">
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">MAT</span>
          <span className="text-sm font-bold text-slate-800">Математика</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="px-3 py-2.5 border-t border-slate-100 first:border-0 space-y-1.5" style={{ opacity: 1 - i * 0.12 }}>
              <div className="flex gap-1.5"><Bar w={52} c="bg-slate-300" /><Bar w={40} /><Bar w={24} c="bg-sky-100" /></div>
              <Bar w={`${80 - i * 7}%`} />
            </div>
          ))}
        </div>
      </div>
      {t < 0 && null}
    </div>
  );
}

function ImportMock({ t, file, counts, activeBtn }: { t: number; file?: number; counts?: number; activeBtn?: "template" | "file" | "load" }) {
  const n = counts === undefined ? 0 : Math.round(3 * fade(t, counts, 600));
  return (
    <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
      <div className="relative bg-white rounded-2xl shadow-2xl" style={{ width: 520, height: 300 }}>
        <div className="px-5 py-3 border-b border-slate-100 text-sm font-bold text-slate-800">Загрузить вопросы таблицей</div>
        <div className="px-5 pt-3 text-[11px] text-slate-500 leading-snug">Excel (.xlsx) или CSV. Строка с номером обновит вопрос, без номера — создаст новый.</div>
        <Btn x={20} y={88} w={100} active={activeBtn === "template"}><FileDown className="w-3.5 h-3.5" /> Шаблон</Btn>
        <Btn x={130} y={88} w={130} primary active={activeBtn === "file"}><Upload className="w-3.5 h-3.5" /> {file !== undefined && t >= file ? "Другой файл" : "Выбрать файл"}</Btn>
        {file !== undefined && (
          <div className="absolute text-[11px] text-slate-500" style={{ left: 272, top: 96, opacity: fade(t, file) }}>Мои вопросы.xlsx · 3 строки</div>
        )}
        {counts !== undefined && (
          <div className="absolute grid grid-cols-4 gap-2" style={{ left: 20, top: 140, width: 480, opacity: fade(t, counts) }}>
            {[["Новых", n, "text-emerald-600"], ["Обновится", 0, "text-sky-600"], ["С ошибками", 0, "text-rose-600"], ["Замечаний", 0, "text-amber-600"]].map(([l, v, c]) => (
              <div key={l as string} className="rounded-lg border border-slate-200 py-1.5 text-center">
                <div className={`text-lg font-bold tabular-nums ${c}`}>{v as number}</div>
                <div className="text-[9px] text-slate-500">{l as string}</div>
              </div>
            ))}
          </div>
        )}
        <div className="absolute flex justify-end gap-2 border-t border-slate-100 pt-3" style={{ left: 20, right: 20, top: 245 }} />
        <Btn x={300} y={256} w={80}>Отмена</Btn>
        <Btn x={390} y={256} w={110} primary active={activeBtn === "load"}>Загрузить {counts !== undefined && t >= counts ? n : ""}</Btn>
      </div>
    </div>
  );
}

const ROWS = [
  ["MAT", "7", "Выбор ответа", "Сколько будет 1/2 + 1/4?", "1/4 · 3/4 · 2/6", "3/4"],
  ["MAT", "7;8", "Ответ числом", "Решите: 3x + 5 = 20", "", "5"],
  ["математика", "8", "выбор", "Найдите 15% от 240", "24 · 36 · 30", "Б"],
];

function SheetMock({ t }: { t: number }) {
  const cols = [["Дисциплина", 78], ["Классы", 46], ["Тип", 92], ["Вопрос", 170], ["Варианты", 120], ["Ответ", 52]] as const;
  return (
    <div className="absolute inset-0 bg-white">
      <div className="h-8 bg-emerald-700 text-white text-[11px] font-semibold flex items-center px-3 gap-2"><span className="w-4 h-4 rounded bg-white/20 grid place-items-center text-[9px]">X</span> Шаблон банка вопросов.xlsx</div>
      <div className="m-3 border border-slate-300 text-[10px]">
        <div className="flex bg-slate-100 font-bold text-slate-700">
          {cols.map(([h, w]) => <div key={h} className="px-1.5 py-1 border-r border-slate-300 last:border-0" style={{ width: w }}>{h}</div>)}
        </div>
        {ROWS.map((r, i) => {
          const start = 400 + i * 1900;
          return (
            <div key={i} className="flex border-t border-slate-200" style={{ background: t >= start && t < start + 1900 ? "rgb(239 246 255)" : undefined }}>
              {r.map((v, j) => (
                <div key={j} className={`px-1.5 py-1.5 border-r border-slate-200 last:border-0 truncate ${j === 5 ? "text-emerald-700 font-semibold" : "text-slate-800"}`} style={{ width: cols[j][1] }}>
                  {typed(v, t, start + j * 220, 40)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {/* Подсказки появляются у колонок, о которых речь */}
      <Tip x={22} y={160} show={fade(t, 1500)} text="Код дисциплины (MAT) или её название словом" />
      <Tip x={300} y={200} show={fade(t, 3200)} text="Варианты — каждый с новой строки (Alt+Enter) или в колонках «Вариант А», «Вариант Б»" />
      <Tip x={400} y={300} show={fade(t, 5000)} text="Ответ — текстом варианта или его буквой" />
    </div>
  );
}
const Tip = ({ x, y, text, show }: { x: number; y: number; text: string; show: number }) => (
  <div className="absolute max-w-[220px] rounded-lg bg-slate-900 text-white text-[11px] leading-snug px-2.5 py-1.5 shadow-lg" style={{ left: x, top: y, opacity: show, transform: `translateY(${(1 - show) * 6}px)` }}>{text}</div>
);

function PreviewMock({ t }: { t: number }) {
  return (
    <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
      <div className="relative bg-white rounded-2xl shadow-2xl px-5 py-3" style={{ width: 560, height: 310 }}>
        <div className="text-sm font-bold text-slate-800 mb-2">Как прочитались вопросы</div>
        <div className="border border-slate-200 rounded-lg text-[10px] overflow-hidden">
          <div className="flex bg-slate-50 font-mono uppercase text-slate-500">{["Стр.", "Номер", "Дисц.", "Тип", "Вопрос", "Ответ"].map((h, i) => <div key={h} className="px-2 py-1" style={{ width: [36, 54, 44, 92, 220, 60][i] }}>{h}</div>)}</div>
          {ROWS.map((r, i) => (
            <div key={i} className="flex border-t border-slate-100" style={{ opacity: fade(t, 300 + i * 450) }}>
              {[String(i + 2), "новый", "MAT", r[2] === "выбор" ? "Выбор ответа" : r[2], r[3], r[2] === "выбор" ? "36" : r[5]].map((v, j) => (
                <div key={j} className={`px-2 py-1.5 truncate ${j === 1 || j === 5 ? "text-emerald-700" : "text-slate-800"}`} style={{ width: [36, 54, 44, 92, 220, 60][j] }}>{v}</div>
              ))}
            </div>
          ))}
        </div>
        <Tip x={250} y={150} show={fade(t, 1700)} text="«математика» и буква «Б» поняты правильно: MAT и ответ «36»" />
        <Btn x={430} y={262} w={110} primary active={t > 3300 && t < 3900}>Загрузить 3</Btn>
      </div>
    </div>
  );
}

function DoneMock({ t }: { t: number }) {
  const k = fade(t, 100, 500);
  return (
    <div className="absolute inset-0 bg-slate-100 p-3">
      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-2 flex items-center gap-2">
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">MAT</span>
        <span className="text-sm font-bold text-slate-800">Математика</span>
      </div>
      <div className="bg-white rounded-xl border border-slate-200">
        {["MAT-0042 · Сколько будет 1/2 + 1/4?", "MAT-0043 · Решите: 3x + 5 = 20", "MAT-0044 · Найдите 15% от 240"].map((s, i) => (
          <div key={s} className="px-3 py-2.5 border-t border-slate-100 first:border-0 text-[12px] text-slate-800" style={{ opacity: fade(t, 900 + i * 300), background: t > 900 + i * 300 && t < 2600 ? "rgb(236 253 245)" : undefined }}>
            <span className="font-mono font-bold">{s.split(" · ")[0]}</span> <span className="ml-1">{s.split(" · ")[1]}</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 top-[200px] flex flex-col items-center" style={{ opacity: k, transform: `scale(${0.8 + 0.2 * k})` }}>
        <CheckCircle2 className="w-12 h-12 text-emerald-600" />
        <div className="mt-1 text-sm font-bold text-slate-800">Загружено: новых 3</div>
        <div className="text-[11px] text-slate-500">Номера выданы сами, вопросы сразу можно включать в экзамены</div>
      </div>
    </div>
  );
}

const SCENES: Scene[] = [
  {
    title: "Откройте загрузку", caption: "«Экзамены» → вкладка «Банк вопросов» → кнопка «Загрузить таблицу» слева, под дисциплинами.",
    duration: 3400, cursor: [{ t: 0, x: 520, y: 300 }, { t: 1500, x: 100, y: 205 }, { t: 1700, x: 100, y: 205, click: true }, { t: 3400, x: 100, y: 205 }],
    render: t => <BankMock t={t} highlight={t > 1700} />,
  },
  {
    title: "Скачайте шаблон", caption: "Нажмите «Шаблон» — скачается Excel с примерами и памяткой. В нём уже правильные колонки.",
    duration: 3600, cursor: [{ t: 0, x: 330, y: 250 }, { t: 1300, x: 130, y: 135 }, { t: 1500, x: 130, y: 135, click: true }, { t: 3600, x: 130, y: 135 }],
    render: t => <><ImportMock t={t} activeBtn={t > 1500 && t < 2100 ? "template" : undefined} />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-3 rounded-lg bg-slate-900 text-white text-[11px] px-3 py-1.5 flex items-center gap-1.5" style={{ opacity: fade(t, 1900) }}><FileDown className="w-3.5 h-3.5" /> Шаблон банка вопросов.xlsx скачан</div></>,
  },
  {
    title: "Заполните таблицу", caption: "Одна строка — один вопрос. Номер оставьте пустым: сайт выдаст его сам. Подходит и старый формат среза.",
    duration: 6800, render: t => <SheetMock t={t} />,
  },
  {
    title: "Выберите файл", caption: "Вернитесь в «Загрузить таблицу» и выберите файл. Сайт сначала только проверяет — ничего не записывает.",
    duration: 3800, cursor: [{ t: 0, x: 420, y: 300 }, { t: 1200, x: 250, y: 135 }, { t: 1400, x: 250, y: 135, click: true }, { t: 3800, x: 250, y: 135 }],
    render: t => <ImportMock t={t} file={1900} counts={2300} activeBtn={t > 1400 && t < 2000 ? "file" : undefined} />,
  },
  {
    title: "Проверьте и загрузите", caption: "Таблица показывает, как сайт понял каждый вопрос. Ошибки подсвечены красным — исправьте их в файле. Всё верно — «Загрузить».",
    duration: 4600, cursor: [{ t: 0, x: 300, y: 330 }, { t: 2600, x: 300, y: 330 }, { t: 3300, x: 525, y: 303 }, { t: 3400, x: 525, y: 303, click: true }, { t: 4600, x: 525, y: 303 }],
    render: t => <PreviewMock t={t} />,
  },
  {
    title: "Готово", caption: "Вопросы в банке с номерами MAT-0042… Добавьте их в набор или отметьте в нужном экзамене.",
    duration: 3600, render: t => <DoneMock t={t} />,
  },
];

const Cursor = ({ x, y, click }: { x: number; y: number; click: number | null }) => (
  <>
    {click !== null && <div className="absolute rounded-full border-2 border-blue-500 pointer-events-none" style={{ left: x - 4 - click * 18, top: y - 4 - click * 18, width: 8 + click * 36, height: 8 + click * 36, opacity: 1 - click }} />}
    <svg className="absolute pointer-events-none drop-shadow" style={{ left: x - 2, top: y - 2, transform: `scale(${click !== null && click < 0.4 ? 0.85 : 1})`, transformOrigin: "2px 2px" }} width="22" height="26" viewBox="0 0 22 26">
      <path d="M2 2 L2 21 L7 16.5 L10.5 24 L14 22.5 L10.5 15 L17.5 15 Z" fill="white" stroke="#0f172a" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  </>
);

export default function ImportGuide({ onClose, onImport, disciplineCode }: { onClose: () => void; onImport?: () => void; disciplineCode?: string }) {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [i, setI] = useState(0);
  const [t, setT] = useState(reduced ? SCENES[0].duration : 0);
  const [playing, setPlaying] = useState(!reduced);
  const wrap = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // Часы ролика: t растёт, в конце сцены — следующая, после последней — пауза.
  useEffect(() => {
    if (!playing) return;
    let raf = 0, prev = performance.now();
    const tick = (now: number) => {
      const dt = now - prev; prev = now;
      setT(x => x + dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  useEffect(() => {
    if (t < SCENES[i].duration + 500) return;
    if (i < SCENES.length - 1) { setI(i + 1); setT(0); } else setPlaying(false);
  }, [t, i]);

  const goto = (k: number) => { setI(k); setT(reduced ? SCENES[k].duration : 0); };
  const scene = SCENES[i];
  const st = Math.min(t, scene.duration);
  const cur = scene.cursor ? cursorAt(scene.cursor, st) : null;
  const total = SCENES.reduce((n, s) => n + s.duration, 0);
  const elapsed = SCENES.slice(0, i).reduce((n, s) => n + s.duration, 0) + st;
  const finished = !playing && i === SCENES.length - 1 && t >= scene.duration;

  return (
    <Modal title="Как загрузить много вопросов сразу" onClose={onClose} wide>
      <div className="space-y-3">
        <div ref={wrap} className="relative w-full overflow-hidden rounded-xl border border-[var(--border-color)] bg-slate-100 select-none" style={{ height: H * scale }}>
          <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
            {scene.render(st)}
            {cur && <Cursor {...cur} />}
          </div>
          <div className="absolute left-0 right-0 bottom-0 h-1 bg-black/10"><div className="h-1 bg-blue-600" style={{ width: `${(elapsed / total) * 100}%` }} /></div>
        </div>

        <div className="flex items-start gap-3">
          <span className="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold grid place-items-center">{i + 1}</span>
          <div className="min-w-0">
            <div className="font-semibold text-[var(--text-main)]">{scene.title}</div>
            <p className="text-sm text-[var(--text-muted)] leading-snug">{scene.caption}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className={btn} onClick={() => goto(Math.max(0, i - 1))} disabled={i === 0} aria-label="Предыдущий шаг"><ChevronLeft className="w-4 h-4" /></button>
          {finished
            ? <button className={btn} onClick={() => { goto(0); setPlaying(true); }}><RotateCcw className="w-4 h-4" /> Сначала</button>
            : <button className={btn} onClick={() => setPlaying(p => !p)}>{playing ? <><Pause className="w-4 h-4" /> Пауза</> : <><Play className="w-4 h-4" /> Смотреть</>}</button>}
          <button className={btn} onClick={() => goto(Math.min(SCENES.length - 1, i + 1))} disabled={i === SCENES.length - 1} aria-label="Следующий шаг"><ChevronRight className="w-4 h-4" /></button>
          <div className="flex gap-1.5 ml-1">
            {SCENES.map((s, k) => <button key={k} onClick={() => goto(k)} title={s.title} aria-label={s.title} className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-blue-600" : "w-2 bg-[var(--border-color)] hover:bg-[var(--text-muted)]"}`} />)}
          </div>
        </div>

        <details className="rounded-xl border border-[var(--border-color)] p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-[var(--text-main)]">Памятка по колонкам</summary>
          <div className="mt-2 grid sm:grid-cols-[150px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
            {[
              ["Дисциплина", "Код (MAT, ENG…) или название словом: «математика». Обязательно."],
              ["Вопрос", "Текст вопроса. Обязательно."],
              ["Правильный ответ", "Текст верного варианта или буква (А, Б…). Несколько допустимых — через ||."],
              ["Варианты", "Каждый с новой строки (Alt+Enter) или через |. Можно и отдельными колонками «Вариант А», «Вариант Б»…"],
              ["Тип", "Пусто — «Выбор ответа». Ещё: «Ответ числом», «Ответ текстом» (или «вписать»), «Упорядочить»."],
              ["Классы", "Через ; — 7;8. Пусто — для всех."],
              ["Наборы", "В какой набор положить (например «Контрольная 1 четверть»). Новый создастся сам."],
              ["Номер", "Пусто — новый вопрос. MAT-0042 — исправить этот вопрос."],
            ].map(([k, v]) => <React.Fragment key={k}><b className="text-[var(--text-main)]">{k}</b><span className="text-[var(--text-muted)]">{v}</span></React.Fragment>)}
          </div>
        </details>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button className={btn} onClick={() => downloadTemplate(disciplineCode)}><FileDown className="w-4 h-4" /> Скачать шаблон</button>
          {onImport && <button className={btnPrimary} onClick={onImport}><Upload className="w-4 h-4" /> Загрузить таблицу</button>}
        </div>
      </div>
    </Modal>
  );
}
