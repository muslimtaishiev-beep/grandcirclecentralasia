import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ImagePlus, Loader2, Mail, Plus, Send, Trash2, X } from "lucide-react";
import { emailApi } from "../../../lib/emailTemplatesApi";
import { compressImageToDataUrl } from "../../../lib/compressImage";
import { btn, btnPrimary, card, input, label } from "../journals/components/ui";
import {
  EMAIL_VARS, EMPTY_EMAIL_TEMPLATE, renderEmail, sampleVars,
  type EmailLogo, type EmailOrg, type EmailTemplate,
} from "../../../shared/emailTemplate";

/**
 * Шаблоны писем организации: слева список, в центре поля, справа —
 * «телефон», где письмо видно так, как его откроет получатель.
 */
type Saved = EmailTemplate & { id: string };

const same = (a: EmailTemplate, b: EmailTemplate) =>
  (["name", "subject", "title", "body", "buttonText", "buttonUrl", "logo", "logoUrl", "imageUrl", "footer", "color"] as const).every(k => a[k] === b[k]);

type Field = "subject" | "title" | "body" | "buttonText" | "footer";

export default function EmailTemplatesPage() {
  const { orgId = "" } = useParams();
  const [list, setList] = useState<Saved[] | null>(null);
  const [org, setOrg] = useState<EmailOrg>({ name: "", logoUrl: null });
  const [fromName, setFromName] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [f, setF] = useState<EmailTemplate>(EMPTY_EMAIL_TEMPLATE);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const focus = useRef<Field>("body");
  const refs = useRef<Partial<Record<Field, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const load = useCallback(async (pick?: string) => {
    try {
      const j = await emailApi(orgId);
      setList(j.templates); setOrg(j.org); setFromName(j.fromName);
      const want = pick || sel;
      const cur = j.templates.find((x: Saved) => x.id === want) || (want === "new" ? null : j.templates[0]);
      if (cur) { setSel(cur.id); setF(cur); } else if (want !== "new") { setSel(null); }
    } catch (e: any) { setMsg({ ok: false, text: e.message }); setList([]); }
  }, [orgId, sel]);
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId]);

  const saved = list?.find(x => x.id === sel) || null;
  const dirty = sel === "new" ? true : !!saved && !same(saved, f);

  const choose = (id: string) => {
    if (dirty && !confirm("Изменения не сохранены. Перейти?")) return;
    const t = list?.find(x => x.id === id);
    if (t) { setSel(id); setF(t); setMsg(null); }
  };
  const create = () => {
    if (dirty && !confirm("Изменения не сохранены. Перейти?")) return;
    setSel("new"); setF({ ...EMPTY_EMAIL_TEMPLATE, name: "Новый шаблон" }); setMsg(null);
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setMsg(null);
    try { await fn(); } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(null); }
  };
  const save = () => run("save", async () => {
    const body = JSON.stringify(f);
    const j = sel === "new" ? await emailApi(orgId, "", { method: "POST", body }) : await emailApi(orgId, `/${sel}`, { method: "PUT", body });
    await load(j.id);
    setMsg({ ok: true, text: "Сохранено" });
  });
  const test = () => run("test", async () => {
    const j = await emailApi(orgId, "/test", { method: "POST", body: JSON.stringify(f) });
    setMsg({ ok: true, text: `Отправлено на ${j.to}` });
  });
  const remove = () => run("del", async () => {
    if (sel === "new") { setSel(null); await load(list?.[0]?.id); return; }
    if (!confirm(`Удалить шаблон «${f.name}»?`)) return;
    try { await emailApi(orgId, `/${sel}`, { method: "DELETE" }); }
    catch (e: any) {
      if (e.status !== 409) throw e;
      if (!confirm(`Шаблон выбран в настройках:\n${(e.data?.used || []).join("\n")}\n\nВсё равно удалить? Там письма перестанут уходить.`)) return;
      await emailApi(orgId, `/${sel}?force=1`, { method: "DELETE" });
    }
    setSel(null); await load("");
  });

  const upload = (key: "logoUrl" | "imageUrl") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    await run(key, async () => {
      const c = await compressImageToDataUrl(file, { maxSide: key === "logoUrl" ? 600 : 1200, maxBytes: 1_400_000 });
      if ("error" in c) throw new Error(c.error);
      const j = await emailApi(orgId, "/image", { method: "POST", body: JSON.stringify({ dataUrl: c.dataUrl }) });
      setF(p => ({ ...p, [key]: j.url, ...(key === "logoUrl" ? { logo: "custom" as EmailLogo } : {}) }));
    });
  };

  /** Чип подстановки — в поле, где стоял курсор. */
  const insertVar = (key: string) => {
    const field = focus.current;
    const el = refs.current[field];
    const tag = `{{${key}}}`;
    const v = f[field];
    const at = el && typeof el.selectionStart === "number" ? el.selectionStart : v.length;
    const end = el && typeof el.selectionEnd === "number" ? el.selectionEnd : at;
    setF({ ...f, [field]: v.slice(0, at) + tag + v.slice(end) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + tag.length, at + tag.length); });
  };
  const bind = (k: Field) => ({
    ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => { refs.current[k] = el; },
    value: f[k],
    onFocus: () => { focus.current = k; },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value }),
  });

  if (!list) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>;
  const editing = sel !== null;

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-[var(--text-main)] flex items-center gap-2"><Mail className="w-6 h-6 text-[var(--accent)]" /> Шаблоны писем</h1>
        <button className={`${btnPrimary} ml-auto`} onClick={create}><Plus className="w-4 h-4" /> Шаблон</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_360px] items-start">
        <nav className={`${card} p-2 flex lg:flex-col gap-1 overflow-x-auto`}>
          {list.map(x => (
            <button key={x.id} onClick={() => choose(x.id)}
              className={`text-left px-3 py-2 rounded-lg text-sm shrink-0 lg:shrink transition ${sel === x.id ? "bg-[var(--accent)]/10 text-[var(--accent)] font-semibold" : "text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`}>
              <div className="truncate max-w-[180px]">{x.name}</div>
              <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[180px]">{x.subject}</div>
            </button>
          ))}
          {sel === "new" && <div className="px-3 py-2 rounded-lg text-sm bg-[var(--accent)]/10 text-[var(--accent)] font-semibold shrink-0">{f.name || "Новый шаблон"}</div>}
          {!list.length && sel !== "new" && <button className="px-3 py-6 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]" onClick={create}>+ Первый шаблон</button>}
        </nav>

        {editing ? (
          <section className={`${card} p-4 space-y-3 min-w-0`}>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><span className={label}>Название шаблона</span><input className={input} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
              <div><span className={label}>Тема письма</span><input className={input} {...bind("subject")} /></div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <span className={label}>Логотип</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {([["org", "Школы"], ["custom", "Свой"], ["none", "Без"]] as const).map(([v, t]) => (
                    <button key={v} onClick={() => setF({ ...f, logo: v })}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition ${f.logo === v ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-semibold" : "border-[var(--border-color)] text-[var(--text-main)]"}`}>{t}</button>
                  ))}
                  {f.logo === "custom" && (
                    <label className={`${btn} cursor-pointer`}>
                      {busy === "logoUrl" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} {f.logoUrl ? "Заменить" : "Загрузить"}
                      <input type="file" accept="image/*" className="hidden" onChange={upload("logoUrl")} />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <span className={label}>Фото</span>
                <div className="flex items-center gap-1.5">
                  <label className={`${btn} cursor-pointer`}>
                    {busy === "imageUrl" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} {f.imageUrl ? "Заменить" : "Загрузить"}
                    <input type="file" accept="image/*" className="hidden" onChange={upload("imageUrl")} />
                  </label>
                  {f.imageUrl && <button className={btn} onClick={() => setF({ ...f, imageUrl: "" })} aria-label="Убрать фото"><X className="w-4 h-4" /></button>}
                </div>
              </div>
            </div>

            <div><span className={label}>Заголовок</span><input className={input} {...bind("title")} /></div>

            <div>
              <span className={label}>Текст</span>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {EMAIL_VARS.map(v => (
                  <button key={v.key} type="button" onMouseDown={e => e.preventDefault()} onClick={() => insertVar(v.key)} title={v.sample}
                    className="px-2 py-0.5 rounded-full text-xs border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
                    {v.label}
                  </button>
                ))}
              </div>
              <textarea rows={9} className={`${input} font-[inherit] leading-relaxed`} {...bind("body")} />
            </div>

            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div><span className={label}>Кнопка</span><input className={input} {...bind("buttonText")} placeholder="Открыть направление" /></div>
              <div>
                <span className={label}>Ссылка кнопки</span>
                <select className={input} value={f.buttonUrl.startsWith("{{") || !f.buttonUrl ? f.buttonUrl : "custom"}
                  onChange={e => setF({ ...f, buttonUrl: e.target.value === "custom" ? "https://" : e.target.value })}>
                  <option value="{{ссылка}}">Ссылка события</option>
                  <option value="custom">Свой адрес</option>
                </select>
              </div>
              <div><span className={label}>Цвет</span><input type="color" className="h-[38px] w-14 rounded-lg border border-[var(--border-color)] bg-transparent cursor-pointer" value={f.color} onChange={e => setF({ ...f, color: e.target.value })} /></div>
            </div>
            {!f.buttonUrl.startsWith("{{") && f.buttonUrl !== "" && (
              <input className={input} value={f.buttonUrl} onChange={e => setF({ ...f, buttonUrl: e.target.value })} placeholder="https://…" />
            )}

            <div><span className={label}>Подпись</span><textarea rows={2} className={input} {...bind("footer")} placeholder={org.signature || ""} /></div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button className={btnPrimary} disabled={!!busy || !dirty} onClick={save}>{busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />} Сохранить</button>
              <button className={btn} disabled={!!busy} onClick={test}>{busy === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Отправить себе</button>
              {msg && <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</span>}
              <button className={`${btn} ml-auto text-rose-600`} disabled={!!busy} onClick={remove}><Trash2 className="w-4 h-4" /> Удалить</button>
            </div>
          </section>
        ) : (
          <section className={`${card} p-10 grid place-items-center`}>
            <button className={btnPrimary} onClick={create}><Plus className="w-4 h-4" /> Создать шаблон</button>
          </section>
        )}

        {editing && <Phone tpl={f} org={org} fromName={fromName} />}
      </div>
    </div>
  );
}

/** Письмо глазами получателя: телефон, почтовая шапка, само письмо. */
function Phone({ tpl, org, fromName }: { tpl: EmailTemplate; org: EmailOrg; fromName: string }) {
  const { subject, html } = useMemo(() => renderEmail(tpl, sampleVars(), org, window.location.origin), [tpl, org]);
  const frame = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(600);
  const fit = () => { const d = frame.current?.contentDocument; if (d?.body) setH(Math.max(300, d.documentElement.scrollHeight)); };
  useEffect(() => { const id = setTimeout(fit, 60); return () => clearTimeout(id); }, [html]);
  const sender = fromName || org.name || "Школа";
  const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="lg:sticky lg:top-4 mx-auto w-full max-w-[360px]">
      <div className="rounded-[2.6rem] border-[10px] border-slate-900 bg-white shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 mx-auto h-5 w-28 bg-slate-900 rounded-b-2xl z-10" />
        <div className="flex justify-between px-6 pt-1.5 pb-1 text-[11px] font-semibold text-slate-900"><span>{time}</span><span>5G ▮▮▮</span></div>
        <div className="h-[620px] overflow-y-auto bg-white">
          <div className="px-4 pt-3 pb-2 border-b border-slate-200">
            <div className="text-[17px] font-bold text-slate-900 leading-snug break-words">{subject}</div>
            <div className="flex items-center gap-2.5 mt-2.5">
              <div className="w-9 h-9 rounded-full text-white grid place-items-center font-bold text-sm shrink-0" style={{ background: tpl.color }}>{sender[0]?.toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-slate-900 truncate">{sender}</div>
                <div className="text-[11px] text-slate-500 truncate">кому: мне</div>
              </div>
              <span className="text-[11px] text-slate-500">{time}</span>
            </div>
          </div>
          <iframe ref={frame} title="Письмо" srcDoc={html} sandbox="allow-same-origin" onLoad={fit} className="w-full block border-0" style={{ height: h }} />
        </div>
      </div>
    </div>
  );
}
