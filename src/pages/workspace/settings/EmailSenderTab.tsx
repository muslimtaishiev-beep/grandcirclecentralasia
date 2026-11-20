import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { emailApi } from "../../../lib/emailTemplatesApi";
import { card, input, label } from "../journals/components/ui";
import { Button, InfoHint, Spinner, toast } from "../../../components/ui";

/** Вкладка «Отправитель»: имя, адрес для ответов, подпись и откуда уходят письма. */
interface Sender {
  orgName: string; fromName: string; replyTo: string; signature: string;
  mode: "platform" | "custom";
  custom: { azureTenant: string; clientId: string; sender: string; hasSecret: boolean; verifiedAt: number; active: boolean };
  effective: { source: "platform" | "tenant"; address: string } | null;
  canEdit: boolean;
}

export default function SenderTab({ orgId }: { orgId: string }) {
  const [d, setD] = useState<Sender | null>(null);
  const [f, setF] = useState({ fromName: "", replyTo: "", signature: "", mode: "platform" as "platform" | "custom", azureTenant: "", clientId: "", sender: "", clientSecret: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ field?: string; text: string } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const apply = (j: Sender) => {
    setD(j);
    setF({ fromName: j.fromName, replyTo: j.replyTo, signature: j.signature, mode: j.mode, azureTenant: j.custom.azureTenant, clientId: j.custom.clientId, sender: j.custom.sender, clientSecret: "" });
  };
  const load = useCallback(async () => {
    try { apply(await emailApi(orgId, "/sender")); setLoadErr(null); } catch (e: any) { setLoadErr(e.message); }
  }, [orgId]);
  useEffect(() => { void load(); }, [load]);

  const body = () => JSON.stringify({ fromName: f.fromName, replyTo: f.replyTo, signature: f.signature, mode: f.mode, custom: { azureTenant: f.azureTenant, clientId: f.clientId, sender: f.sender, ...(f.clientSecret ? { clientSecret: f.clientSecret } : {}) } });
  const save = async () => {
    setBusy("save"); setErr(null);
    try { const j = await emailApi(orgId, "/sender", { method: "PUT", body: body() }); apply({ ...j, canEdit: true }); toast.success("Сохранено"); }
    catch (e: any) { setErr({ field: e.data?.field, text: e.message }); }
    finally { setBusy(null); }
  };
  const verify = async () => {
    setBusy("verify"); setErr(null);
    try {
      await emailApi(orgId, "/sender", { method: "PUT", body: body() });
      const j = await emailApi(orgId, "/sender/verify", { method: "POST" });
      apply({ ...j, canEdit: true }); toast.success(`Подключено. Проверочное письмо отправлено на ${j.to}`);
    } catch (e: any) { setErr({ field: e.data?.field, text: e.message }); await load(); }
    finally { setBusy(null); }
  };

  if (loadErr) return <div className="py-10 text-center space-y-3"><div className="text-sm text-rose-600">{loadErr}</div><Button onClick={() => void load()}>Повторить</Button></div>;
  if (!d) return <Spinner />;
  const ro = !d.canEdit;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const bad = (k: string) => (err?.field === k ? "!border-rose-500" : "");
  const seg = (on: boolean) => `px-3 py-1.5 rounded-lg text-sm border transition ${on ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-semibold" : "border-[var(--border-color)] text-[var(--text-main)]"}`;
  const custom = f.mode === "custom";

  return (
    <div className="max-w-2xl space-y-4">
      <section className={`${card} p-4 space-y-3`}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><span className={label}>Имя отправителя</span><input className={input} disabled={ro} value={f.fromName} onChange={set("fromName")} placeholder={d.orgName} maxLength={60} /></div>
          <div><span className={label}>Адрес для ответов</span><input className={`${input} ${bad("replyTo")}`} disabled={ro} type="email" value={f.replyTo} onChange={set("replyTo")} placeholder="info@…" /></div>
        </div>
        <div><span className={label}>Подпись</span><textarea rows={3} className={input} disabled={ro} value={f.signature} onChange={set("signature")} maxLength={300} /></div>
      </section>

      <section className={`${card} p-4 space-y-3`}>
        <div className="flex items-center gap-2">
          <span className={label}>Ящик отправки</span>
          <InfoHint>Письма уходят с общего ящика платформы под вашим именем. Если подключить свой ящик Microsoft 365, получатели увидят ваш адрес. Пока ящик не проверен, письма идут с общего.</InfoHint>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button disabled={ro} className={seg(!custom)} onClick={() => setF({ ...f, mode: "platform" })}>Общий платформы</button>
          <button disabled={ro} className={seg(custom)} onClick={() => setF({ ...f, mode: "custom" })}>Свой (Microsoft 365)</button>
        </div>
        {custom && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div><span className={label}>Адрес ящика</span><input className={`${input} ${bad("sender")}`} disabled={ro} type="email" value={f.sender} onChange={set("sender")} placeholder="no-reply@…" /></div>
            <div><span className={label}>Каталог (Tenant ID)</span><input className={`${input} ${bad("custom")}`} disabled={ro} value={f.azureTenant} onChange={set("azureTenant")} /></div>
            <div><span className={label}>Приложение (Client ID)</span><input className={`${input} ${bad("custom")}`} disabled={ro} value={f.clientId} onChange={set("clientId")} /></div>
            <div><span className={label}>Секрет (Client secret)</span><input className={`${input} ${bad("custom")}`} disabled={ro} type="password" autoComplete="new-password" value={f.clientSecret} onChange={set("clientSecret")} placeholder={d.custom.hasSecret ? "••••••••" : ""} /></div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {d.effective
            ? <span className="inline-flex items-center gap-1.5 text-[var(--text-main)]"><CheckCircle2 className={`w-4 h-4 ${d.effective.source === "tenant" ? "text-emerald-600" : "text-[var(--text-muted)]"}`} /> Сейчас: {d.effective.address}</span>
            : <span className="text-rose-600">Почта не настроена</span>}
        </div>
        {err && <div className="text-sm text-rose-600">{err.text}</div>}
        {!ro && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="primary" loading={busy === "save"} disabled={!!busy} onClick={save}>Сохранить</Button>
            {custom && <Button loading={busy === "verify"} disabled={!!busy} icon={<Send className="w-4 h-4" />} onClick={verify}>Проверить</Button>}
          </div>
        )}
      </section>
    </div>
  );
}
