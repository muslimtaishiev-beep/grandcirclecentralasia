import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Calendar, Download, Printer, RefreshCw, Loader2, Check, Users, Settings2, FileText, Info, Landmark, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { auth } from "../../../lib/firebase";
import { resolveLegalProfile } from "../../../shared/legal";
import {
  calculatePayroll, resolvePayrollSettings, money,
  PAY_TYPE_LABEL, CONTRACT_LABEL, STATUS_LABEL,
  type EmployeeTerms, type PayrollSettings, type PayrollStatus,
} from "../../../shared/payroll";

/**
 * Зарплаты — все сотрудники организации, расчёт по правилам КР.
 *
 * Вкладки: ведомость за месяц, сотрудники и условия, Касса и движения денег, настройки ставок.
 */
type Rec = any;
const month0 = () => new Date().toISOString().slice(0, 7);
const fmt = (n: number) => (Number(n) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthTitle = (m: string) => { const [y, mm] = m.split("-"); return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" }); };
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export default function TeacherPayrollPage() {
  const { activeTenant } = useOutletContext<{ activeTenant: any }>();
  const tenantId: string = activeTenant?.id || "";
  const legal = resolveLegalProfile(activeTenant);

  const [tab, setTab] = useState<"statement" | "employees" | "cash" | "settings">("statement");
  const [month, setMonth] = useState(month0());
  const [records, setRecords] = useState<Rec[]>([]);
  const [employees, setEmployees] = useState<EmployeeTerms[]>([]);
  const [settings, setSettings] = useState<PayrollSettings>(resolvePayrollSettings({}));
  const [cashSummary, setCashSummary] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [editTerms, setEditTerms] = useState<EmployeeTerms | null>(null);

  const say = (m: string) => { setNotice(m); setTimeout(() => setNotice(null), 5000); };
  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    const res = await fetch(`/api/payroll/${tenantId}${path}`, {
      ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.success === false) throw new Error(j.error || `Ошибка ${res.status}`);
    return j;
  }, [tenantId]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true); setError(null);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
      const [r, e, s, finRes] = await Promise.all([
        api(`/records?month=${month}`),
        api("/employees"),
        api("/settings"),
        fetch(`/api/tenant/finance-summary?tenantId=${encodeURIComponent(tenantId)}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => res.json()).catch(() => ({}))
      ]);
      setRecords(r.records || []);
      setEmployees(e.employees || []);
      setSettings(resolvePayrollSettings(s.settings));
      if (finRes && finRes.success) {
        setCashSummary(finRes);
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [api, tenantId, month]);
  useEffect(() => { void load(); }, [load]);

  const run = async () => {
    setBusy(true); setError(null);
    try {
      const j = await api("/run", { method: "POST", body: JSON.stringify({ month }) });
      setRecords(j.records || []);
      say(`Ведомость сформирована: новых ${j.created}, обновлено ${j.refreshed}, утверждённых не тронуто ${j.skipped}.`);
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };
  const setStatus = async (rec: Rec, status: PayrollStatus) => {
    setBusy(true); setError(null);
    try { await api(`/records/${rec.id}/status`, { method: "POST", body: JSON.stringify({ status }) }); await load(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };
  const saveInputs = async () => {
    if (!editing) return;
    setBusy(true); setError(null);
    try { await api(`/records/${editing.id}`, { method: "PUT", body: JSON.stringify({ inputs: editing.inputs }) }); setEditing(null); await load(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };
  const saveTerms = async () => {
    if (!editTerms) return;
    setBusy(true); setError(null);
    try { await api(`/employees/${editTerms.membershipId}`, { method: "PUT", body: JSON.stringify({ terms: editTerms }) }); setEditTerms(null); say("Условия сохранены"); await load(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };
  const saveSettings = async () => {
    setBusy(true); setError(null);
    try { const j = await api("/settings", { method: "PUT", body: JSON.stringify({ settings }) }); setSettings(resolvePayrollSettings(j.settings)); say("Ставки сохранены. Пересчёт — кнопкой «Сформировать ведомость»."); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  const totals = useMemo(() => {
    const sum = (f: (r: Rec) => number) => Math.round(records.reduce((s, r) => s + (Number(f(r)) || 0), 0) * 100) / 100;
    return { gross: sum(r => r.calc.gross), sfEmployee: sum(r => r.calc.sfEmployee), incomeTax: sum(r => r.calc.incomeTax),
      toPay: sum(r => r.calc.toPay), sfEmployer: sum(r => r.calc.sfEmployer), totalCost: sum(r => r.calc.totalCost),
      paid: sum(r => (r.status === "paid" ? r.calc.toPay : 0)) };
  }, [records]);
  const cur = settings.currency;

  const openPrint = (html: string) => {
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) { setError("Браузер заблокировал окно печати — разрешите всплывающие окна."); return; }
    w.document.write(html); w.document.close();
  };
  const printStatement = () => {
    const head = `<div class="org"><b>${esc(legal.legalName || activeTenant?.name)}</b>${legal.inn ? ` · ИНН ${esc(legal.inn)}` : ""}${legal.address ? `<br>${esc(legal.address)}` : ""}</div>`;
    const rows = records.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.fullName)}</td><td>${esc(r.position)}</td><td>${r.contractType === "civil" ? "ГПХ" : "Трудовой"}</td>
      <td class="n">${fmt(r.calc.gross)}</td><td class="n">${fmt(r.calc.sfEmployee)}</td><td class="n">${fmt(r.calc.incomeTax)}</td><td class="n">${fmt(r.inputs.otherDeductions + r.inputs.advance)}</td><td class="n"><b>${fmt(r.calc.toPay)}</b></td><td class="sig"></td></tr>`).join("");
    openPrint(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Расчётная ведомость ${month}</title>
<style>body{font-family:"Times New Roman",serif;font-size:12px;margin:14mm}h1{font-size:16px;text-align:center;margin:8px 0 2px}.sub{text-align:center;margin-bottom:12px}.org{margin-bottom:10px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:4px 6px;vertical-align:top}th{background:#f2f2f2;font-weight:bold;text-align:center}.n{text-align:right;white-space:nowrap}.sig{width:70px}.tot td{font-weight:bold}.foot{margin-top:18px;display:flex;justify-content:space-between}.note{margin-top:10px;font-size:11px;color:#333}@media print{.noprint{display:none}}</style></head><body>
${head}<h1>РАСЧЁТНАЯ ВЕДОМОСТЬ</h1><div class="sub">за ${esc(monthTitle(month))} · валюта ${esc(cur)}</div>
<table><thead><tr><th>№</th><th>ФИО</th><th>Должность</th><th>Договор</th><th>Начислено</th><th>Взносы в Соцфонд (работник ${settings.sfEmployeePensionPct + settings.sfEmployeeAccumPct}%)</th><th>Подоходный налог ${settings.incomeTaxPct}%</th><th>Удержания и аванс</th><th>К выплате</th><th>Подпись</th></tr></thead>
<tbody>${rows}<tr class="tot"><td></td><td>ИТОГО</td><td></td><td></td><td class="n">${fmt(totals.gross)}</td><td class="n">${fmt(totals.sfEmployee)}</td><td class="n">${fmt(totals.incomeTax)}</td><td class="n"></td><td class="n">${fmt(totals.toPay)}</td><td></td></tr></tbody></table>
<div class="note">Взносы работодателя в Соцфонд (${settings.sfEmployerPensionPct + settings.sfEmployerMedicalPct + settings.sfEmployerHealthPct}%): ${fmt(totals.sfEmployer)} ${esc(cur)}. Общие затраты на оплату труда: ${fmt(totals.totalCost)} ${esc(cur)}.<br>Вычеты при расчёте подоходного налога: ${settings.personalDeductionRp} РП на работника и ${settings.dependentDeductionRp} РП на иждивенца, РП = ${settings.rp} ${esc(cur)}.</div>
<div class="foot"><div>Руководитель: ______________ ${esc(legal.signatoryName || "")}</div><div>Бухгалтер: ______________</div><div>Дата: ${new Date().toLocaleDateString("ru-RU")}</div></div>
<div class="noprint" style="margin-top:14px"><button onclick="window.print()">Печать</button></div></body></html>`);
  };
  const printSlip = (r: Rec) => {
    const c = r.calc; const line = (k: string, v: string) => `<tr><td>${k}</td><td class="n">${v}</td></tr>`;
    openPrint(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Расчётный листок ${esc(r.fullName)} ${month}</title>
<style>body{font-family:"Times New Roman",serif;font-size:13px;margin:16mm;max-width:640px}h1{font-size:16px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:10px}td{border:1px solid #000;padding:5px 8px}.n{text-align:right;white-space:nowrap}.h td{background:#f2f2f2;font-weight:bold}.tot td{font-weight:bold}@media print{.noprint{display:none}}</style></head><body>
<div><b>${esc(legal.legalName || activeTenant?.name)}</b>${legal.inn ? ` · ИНН ${esc(legal.inn)}` : ""}</div>
<h1 style="margin-top:10px">Расчётный листок за ${esc(monthTitle(month))}</h1>
<div>${esc(r.fullName)}${r.position ? `, ${esc(r.position)}` : ""} · ${esc(CONTRACT_LABEL[r.contractType as keyof typeof CONTRACT_LABEL])}${r.inn ? ` · ИНН ${esc(r.inn)}` : ""}</div>
<table><tr class="h"><td>Начислено</td><td class="n">${esc(cur)}</td></tr>
${line(`${esc(PAY_TYPE_LABEL[r.payType as keyof typeof PAY_TYPE_LABEL])}: ${fmt(r.rate)}${r.payType === "hourly" ? ` × ${r.inputs.hours} ч` : r.payType === "per_lesson" ? ` × ${r.inputs.lessons} зан.` : ""}`, fmt(c.gross - r.inputs.bonuses))}
${r.inputs.bonuses ? line("Премии и надбавки", fmt(r.inputs.bonuses)) : ""}
<tr class="tot"><td>Итого начислено</td><td class="n">${fmt(c.gross)}</td></tr>
<tr class="h"><td>Удержано</td><td class="n"></td></tr>
${line(`Взносы в Соцфонд: ПФ ${settings.sfEmployeePensionPct}% + ГНПФ ${settings.sfEmployeeAccumPct}%`, fmt(c.sfEmployee))}
${line(`Подоходный налог ${settings.incomeTaxPct}% (база ${fmt(c.taxable)}, вычеты ${fmt(c.deductionsBase)})`, fmt(c.incomeTax))}
${r.inputs.otherDeductions ? line("Прочие удержания", fmt(r.inputs.otherDeductions)) : ""}
${r.inputs.advance ? line("Выплаченный аванс", fmt(r.inputs.advance)) : ""}
<tr class="tot"><td>К ВЫПЛАТЕ</td><td class="n">${fmt(c.toPay)}</td></tr>
<tr class="h"><td>Справочно: взносы работодателя в Соцфонд</td><td class="n">${fmt(c.sfEmployer)}</td></tr></table>
${r.inputs.note ? `<p>Примечание: ${esc(r.inputs.note)}</p>` : ""}
<p>Статус: ${esc(STATUS_LABEL[r.status as PayrollStatus])}${r.paidAt ? `, выплачено ${new Date(r.paidAt).toLocaleDateString("ru-RU")}` : ""}</p>
<div class="noprint"><button onclick="window.print()">Печать</button></div></body></html>`);
  };
  const downloadCsv = async () => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    const res = await fetch(`/api/payroll/${tenantId}/statement?month=${month}&format=csv`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { setError("Не удалось выгрузить CSV"); return; }
    const blob = await res.blob(); const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `vedomost-${month}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const input = "w-full px-3 py-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl text-sm";
  const preview = editing ? calculatePayroll({ membershipId: editing.membershipId, fullName: editing.fullName, position: editing.position, contractType: editing.contractType, payType: editing.payType, rate: editing.rate, dependents: editing.dependents, active: true }, editing.inputs, settings) : null;

  return (
    <div className="max-w-6xl mx-auto space-y-5 text-[var(--text-main)]" data-testid="payroll-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-2xl font-bold">Зарплаты</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Все сотрудники организации · расчёт по правилам Кыргызской Республики · ведомость и расчётные листки</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} data-testid="payroll-month"
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl pl-9 pr-3 py-2 text-sm font-bold" />
          </div>
          <button onClick={() => void run()} disabled={busy} data-testid="payroll-run"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Сформировать ведомость
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl p-1 text-xs w-fit">
        {([["statement", "Ведомость", FileText], ["employees", `Сотрудники и условия (${employees.length})`, Users], ["cash", "Касса и движения", Landmark], ["settings", "Ставки и вычеты", Settings2]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`payroll-tab-${k}`}
            className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 ${tab === k ? "bg-[var(--bg-surface)] text-emerald-500 shadow-xs" : "text-[var(--text-muted)]"}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-500">{error}</div>}
      {notice && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-600">{notice}</div>}
      {loading && <div className="py-10 text-center text-[var(--text-muted)]"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}

      {/* ── Ведомость ── */}
      {!loading && tab === "statement" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {([["Начислено", totals.gross], ["Взносы работника", totals.sfEmployee], ["Подоходный налог", totals.incomeTax], ["К выплате", totals.toPay], ["Взносы работодателя", totals.sfEmployer]] as const).map(([l, v]) => (
              <div key={l} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-3">
                <div className="text-[11px] uppercase font-mono text-[var(--text-muted)]">{l}</div>
                <div className="text-lg font-black tabular-nums">{fmt(v)} <span className="text-xs font-normal text-[var(--text-muted)]">{cur}</span></div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={printStatement} disabled={!records.length} className="px-3 py-2 rounded-xl border border-[var(--border-color)] text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Printer className="w-4 h-4" /> Печать ведомости</button>
            <button onClick={() => void downloadCsv()} disabled={!records.length} className="px-3 py-2 rounded-xl border border-[var(--border-color)] text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Download className="w-4 h-4" /> CSV для бухгалтерии</button>
            <span className="text-xs text-[var(--text-muted)]">Выплачено: {fmt(totals.paid)} {cur} · общие затраты с взносами работодателя: {fmt(totals.totalCost)} {cur}</span>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-[var(--bg-panel)] text-[11px] uppercase font-mono text-[var(--text-muted)]">
                <tr><th className="px-3 py-3 text-left">Сотрудник</th><th className="px-3 py-3 text-left">Оплата</th><th className="px-3 py-3 text-right">Начислено</th><th className="px-3 py-3 text-right">Взносы</th><th className="px-3 py-3 text-right">Налог</th><th className="px-3 py-3 text-right">Удерж. + аванс</th><th className="px-3 py-3 text-right">К выплате</th><th className="px-3 py-3 text-center">Статус</th><th className="px-3 py-3"></th></tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-t border-[var(--border-color)]" data-testid={`payroll-row-${r.membershipId}`}>
                    <td className="px-3 py-3"><div className="font-semibold">{r.fullName}</div><div className="text-[11px] text-[var(--text-muted)]">{r.position}{r.contractType === "civil" ? " · ГПХ" : ""}</div></td>
                    <td className="px-3 py-3 text-xs">{PAY_TYPE_LABEL[r.payType as keyof typeof PAY_TYPE_LABEL]} · {fmt(r.rate)}{r.payType === "hourly" ? ` × ${r.inputs.hours} ч` : r.payType === "per_lesson" ? ` × ${r.inputs.lessons}` : ""}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(r.calc.gross)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[var(--text-muted)]">{fmt(r.calc.sfEmployee)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[var(--text-muted)]">{fmt(r.calc.incomeTax)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[var(--text-muted)]">{fmt(r.inputs.otherDeductions + r.inputs.advance)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-black" data-testid={`payroll-topay-${r.membershipId}`}>{fmt(r.calc.toPay)}</td>
                    <td className="px-3 py-3 text-center"><span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${r.status === "paid" ? "bg-emerald-500/15 text-emerald-600" : r.status === "approved" ? "bg-sky-500/15 text-sky-600" : "bg-slate-500/15 text-slate-500"}`}>{STATUS_LABEL[r.status as PayrollStatus]}</span></td>
                    <td className="px-3 py-3 text-right whitespace-nowrap space-x-2">
                      {r.status === "draft" && <button onClick={() => setEditing({ ...r, inputs: { ...r.inputs } })} className="text-xs font-bold text-emerald-500">Изменить</button>}
                      {r.status === "draft" && <button onClick={() => void setStatus(r, "approved")} className="text-xs font-bold text-sky-500">Утвердить</button>}
                      {r.status === "approved" && <button onClick={() => void setStatus(r, "paid")} className="text-xs font-bold text-emerald-500">Выплачено</button>}
                      {r.status === "approved" && <button onClick={() => void setStatus(r, "draft")} className="text-xs text-[var(--text-muted)]">В черновик</button>}
                      <button onClick={() => printSlip(r)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]">Листок</button>
                    </td>
                  </tr>
                ))}
                {!records.length && <tr><td colSpan={9} className="px-3 py-10 text-center text-[var(--text-muted)] text-sm">
                  За {monthTitle(month)} ведомости ещё нет. Задайте условия оплаты сотрудникам во вкладке «Сотрудники и условия» и нажмите «Сформировать ведомость».
                </td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Сотрудники и условия ── */}
      {!loading && tab === "employees" && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-[var(--bg-panel)] text-[11px] uppercase font-mono text-[var(--text-muted)]">
              <tr><th className="px-3 py-3 text-left">Сотрудник</th><th className="px-3 py-3 text-left">Должность</th><th className="px-3 py-3 text-left">Договор</th><th className="px-3 py-3 text-left">Оплата</th><th className="px-3 py-3 text-right">Ставка</th><th className="px-3 py-3 text-center">Иждивенцы</th><th className="px-3 py-3 text-center">В расчёте</th><th className="px-3 py-3"></th></tr>
            </thead>
            <tbody>
              {employees.map(e => (
                <tr key={e.membershipId} className="border-t border-[var(--border-color)]" data-testid={`payroll-emp-${e.membershipId}`}>
                  <td className="px-3 py-3 font-semibold">{e.fullName}</td>
                  <td className="px-3 py-3 text-xs">{e.position || "—"}</td>
                  <td className="px-3 py-3 text-xs">{CONTRACT_LABEL[e.contractType]}</td>
                  <td className="px-3 py-3 text-xs">{PAY_TYPE_LABEL[e.payType]}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{e.rate ? fmt(e.rate) : <span className="text-amber-600 text-xs">не задана</span>}</td>
                  <td className="px-3 py-3 text-center">{e.dependents}</td>
                  <td className="px-3 py-3 text-center">{e.active && e.rate ? <Check className="w-4 h-4 text-emerald-500 inline" /> : <span className="text-[var(--text-muted)]">—</span>}</td>
                  <td className="px-3 py-3 text-right"><button onClick={() => setEditTerms({ ...e })} data-testid={`payroll-terms-${e.membershipId}`} className="text-xs font-bold text-emerald-500">Условия</button></td>
                </tr>
              ))}
              {!employees.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[var(--text-muted)] text-sm">Сотрудников нет — добавьте их в «Роли и доступы».</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Касса и движения денег ── */}
      {!loading && tab === "cash" && (
        <div className="space-y-6">
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs text-emerald-700 flex gap-3 items-start">
            <Landmark className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-emerald-900 mb-0.5">Касса организации и учет движения средств</div>
              Синхронизированный учет кассы: поступления формируются из <b>вступительных взносов</b> и <b>оплат по месяцам</b> принятых учеников, а расходами являются <b>выплаты по зарплатным ведомостям (ФОТ)</b>. Годовая стоимость договоров фиксируется справочно и не завышает баланс кассы.
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--bg-surface)] border border-emerald-500/30 rounded-2xl p-4 shadow-sm">
              <div className="text-[11px] uppercase font-bold text-emerald-600 tracking-wider">Касса (Фактически)</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {((cashSummary?.totalCashCollected || 0)).toLocaleString("ru-RU")} сом
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">Взносы + оклады по месяцам</div>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 shadow-sm">
              <div className="text-[11px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Договоры за год (со скидкой)</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {((cashSummary?.totalContractValue || 0)).toLocaleString("ru-RU")} сом
              </div>
              <div className="text-[11px] text-blue-600 font-medium mt-1">Общий объем ({cashSummary?.acceptedCount || 0} учеников)</div>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 shadow-sm">
              <div className="text-[11px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Расходы на Зарплаты (ФОТ)</div>
              <div className="text-2xl font-black text-purple-600 mt-1">
                {((cashSummary?.totalPayroll || totals.totalCost || 0)).toLocaleString("ru-RU")} сом
              </div>
              <div className="text-[11px] text-purple-600 font-medium mt-1">Начисления сотрудникам</div>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 shadow-sm">
              <div className="text-[11px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Чистый баланс кассы</div>
              <div className={`text-2xl font-black mt-1 ${(cashSummary?.netBalance || 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {((cashSummary?.netBalance || 0)).toLocaleString("ru-RU")} сом
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">Касса (факт) − ФОТ</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                Поступления в кассу от учеников
              </h3>
              <span className="text-xs text-[var(--text-muted)]">Принято учеников: {cashSummary?.acceptedCount || 0}</span>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-x-auto shadow-sm">
              <table className="w-full text-sm min-w-[850px]">
                <thead className="bg-[var(--bg-panel)] text-[11px] uppercase font-mono text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left">Ученик</th>
                    <th className="px-4 py-3 text-left">Класс</th>
                    <th className="px-4 py-3 text-left">Способ оплаты</th>
                    <th className="px-4 py-3 text-right">Вступительный взнос</th>
                    <th className="px-4 py-3 text-right">Оплачено по месяцам</th>
                    <th className="px-4 py-3 text-right">Итого в кассу</th>
                    <th className="px-4 py-3 text-right">Договор за год</th>
                  </tr>
                </thead>
                <tbody>
                  {(cashSummary?.studentTransactions || []).map((t: any) => (
                    <tr key={t.id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-panel)]/50 transition">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{t.studentName}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{t.grade ? `${t.grade} класс` : "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 font-semibold border border-emerald-500/20">
                          {t.paymentInfo || "MBANK"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">
                        {(t.initialFee || 0).toLocaleString("ru-RU")} сом
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">
                        {(t.monthlyPaidSum || 0).toLocaleString("ru-RU")} сом
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-black text-emerald-600">
                        {(t.totalPaidIntoCash || 0).toLocaleString("ru-RU")} сом
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--text-muted)] font-mono text-xs">
                        {(t.totalCost || 0).toLocaleString("ru-RU")} сом
                      </td>
                    </tr>
                  ))}
                  {(!cashSummary?.studentTransactions || cashSummary.studentTransactions.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                        Поступлений в кассу пока нет. При принятии учеников внесенные взносы будут отображаться здесь автоматически.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-rose-500" />
                Расходы кассы на выплату зарплат ({monthTitle(month)})
              </h3>
              <span className="text-xs text-[var(--text-muted)]">Общие расходы: {fmt(totals.totalCost)} {cur}</span>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-x-auto shadow-sm">
              <table className="w-full text-sm min-w-[850px]">
                <thead className="bg-[var(--bg-panel)] text-[11px] uppercase font-mono text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left">Сотрудник</th>
                    <th className="px-4 py-3 text-left">Должность</th>
                    <th className="px-4 py-3 text-right">Начислено</th>
                    <th className="px-4 py-3 text-right">Удержания / Налоги</th>
                    <th className="px-4 py-3 text-right">К выплате из кассы</th>
                    <th className="px-4 py-3 text-center">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r: any) => (
                    <tr key={r.id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-panel)]/50 transition">
                      <td className="px-4 py-3 font-semibold">{r.fullName}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{r.position || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(r.calc.gross)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--text-muted)]">{fmt(r.calc.sfEmployee + r.calc.incomeTax)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-black text-rose-600">{fmt(r.calc.toPay)} {cur}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${r.status === "paid" ? "bg-emerald-500/15 text-emerald-600" : r.status === "approved" ? "bg-sky-500/15 text-sky-600" : "bg-slate-500/15 text-slate-500"}`}>
                          {STATUS_LABEL[r.status as PayrollStatus]}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!records.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                        За {monthTitle(month)} ведомости выплат еще нет.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Ставки и вычеты ── */}
      {!loading && tab === "settings" && (
        <div className="space-y-4 max-w-3xl">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            Умолчания соответствуют законодательству Кыргызской Республики на момент настройки модуля: подоходный налог 10 %, взносы работника в Соцфонд 10 % (ПФ 8 % + ГНПФ 2 %), работодателя 17,25 % (ПФ 15 %, ФОМС 2 %, Фонд оздоровления 0,25 %), вычеты 6,5 РП на работника и 1 РП на иждивенца при РП = 100 сом. Ставки меняются — сверьте с бухгалтером и при необходимости поправьте здесь.
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {([["currency", "Валюта", "text"], ["rp", "Расчётный показатель (РП), сом", "number"], ["personalDeductionRp", "Вычет на работника, в РП", "number"], ["dependentDeductionRp", "Вычет на иждивенца, в РП", "number"],
              ["incomeTaxPct", "Подоходный налог, %", "number"], ["sfEmployeePensionPct", "Работник: Пенсионный фонд, %", "number"], ["sfEmployeeAccumPct", "Работник: ГНПФ (накопительный), %", "number"],
              ["sfEmployerPensionPct", "Работодатель: Пенсионный фонд, %", "number"], ["sfEmployerMedicalPct", "Работодатель: ФОМС, %", "number"], ["sfEmployerHealthPct", "Работодатель: Фонд оздоровления, %", "number"],
              ["civilSfEmployeePct", "ГПХ: взносы с исполнителя, %", "number"], ["civilSfEmployerPct", "ГПХ: взносы заказчика, %", "number"], ["payDay", "День выплаты", "number"]] as const).map(([k, label, type]) => (
              <label key={k} className="block">
                <span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">{label}</span>
                <input type={type} step="0.01" value={(settings as any)[k]} data-testid={`payroll-set-${k}`}
                  onChange={e => setSettings(s => ({ ...s, [k]: type === "number" ? Number(e.target.value) : e.target.value }))} className={input} />
              </label>
            ))}
          </div>
          <button onClick={() => void saveSettings()} disabled={busy} data-testid="payroll-settings-save"
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Сохранить ставки
          </button>
        </div>
      )}

      {/* ── Условия сотрудника ── */}
      {editTerms && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !busy && setEditTerms(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-lg w-full p-6 space-y-3 shadow-2xl" data-testid="payroll-terms-modal">
            <h2 className="font-bold">Условия оплаты · {editTerms.fullName}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2"><span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">ФИО для ведомости</span>
                <input value={editTerms.fullName} onChange={e => setEditTerms({ ...editTerms, fullName: e.target.value })} className={input} /></label>
              <label className="block"><span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">Должность</span>
                <input value={editTerms.position} onChange={e => setEditTerms({ ...editTerms, position: e.target.value })} className={input} /></label>
              <label className="block"><span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">ИНН</span>
                <input value={editTerms.inn || ""} onChange={e => setEditTerms({ ...editTerms, inn: e.target.value })} className={input} /></label>
              <label className="block"><span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">Договор</span>
                <select value={editTerms.contractType} onChange={e => setEditTerms({ ...editTerms, contractType: e.target.value as any })} className={input} data-testid="terms-contract">
                  {Object.entries(CONTRACT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="block"><span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">Тип оплаты</span>
                <select value={editTerms.payType} onChange={e => setEditTerms({ ...editTerms, payType: e.target.value as any })} className={input} data-testid="terms-paytype">
                  {Object.entries(PAY_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="block"><span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">{editTerms.payType === "monthly" ? "Оклад в месяц" : editTerms.payType === "hourly" ? "Ставка за час" : "Ставка за занятие"}, {cur}</span>
                <input type="number" min={0} value={editTerms.rate} onChange={e => setEditTerms({ ...editTerms, rate: Number(e.target.value) })} className={input} data-testid="terms-rate" /></label>
              <label className="block"><span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">Иждивенцев</span>
                <input type="number" min={0} max={20} value={editTerms.dependents} onChange={e => setEditTerms({ ...editTerms, dependents: Number(e.target.value) })} className={input} data-testid="terms-dependents" /></label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2 cursor-pointer"><input type="checkbox" checked={editTerms.active} onChange={e => setEditTerms({ ...editTerms, active: e.target.checked })} /> Включать в ведомость</label>
            </div>
            <div className="flex gap-2 pt-2 border-t border-[var(--border-color)]">
              <button onClick={() => setEditTerms(null)} disabled={busy} className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] font-bold text-sm">Отмена</button>
              <button onClick={() => void saveTerms()} disabled={busy} data-testid="terms-save" className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ввод за месяц ── */}
      {editing && preview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !busy && setEditing(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-lg w-full p-6 space-y-3 shadow-2xl" data-testid="payroll-edit-modal">
            <h2 className="font-bold">{editing.fullName} · {monthTitle(month)}</h2>
            <div className="grid grid-cols-2 gap-3">
              {editing.payType === "hourly" && <label className="block"><span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">Часов</span><input type="number" min={0} value={editing.inputs.hours} onChange={e => setEditing({ ...editing, inputs: { ...editing.inputs, hours: Number(e.target.value) } })} className={input} data-testid="edit-hours" /></label>}
              {editing.payType === "per_lesson" && <label className="block"><span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">Занятий</span><input type="number" min={0} value={editing.inputs.lessons} onChange={e => setEditing({ ...editing, inputs: { ...editing.inputs, lessons: Number(e.target.value) } })} className={input} data-testid="edit-lessons" /></label>}
              <label className="block"><span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">Премии, надбавки</span><input type="number" min={0} value={editing.inputs.bonuses} onChange={e => setEditing({ ...editing, inputs: { ...editing.inputs, bonuses: Number(e.target.value) } })} className={input} data-testid="edit-bonuses" /></label>
              <label className="block"><span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">Прочие удержания</span><input type="number" min={0} value={editing.inputs.otherDeductions} onChange={e => setEditing({ ...editing, inputs: { ...editing.inputs, otherDeductions: Number(e.target.value) } })} className={input} /></label>
              <label className="block"><span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">Выплаченный аванс</span><input type="number" min={0} value={editing.inputs.advance} onChange={e => setEditing({ ...editing, inputs: { ...editing.inputs, advance: Number(e.target.value) } })} className={input} data-testid="edit-advance" /></label>
              <label className="block col-span-2"><span className="block text-[11px] uppercase font-mono font-bold text-[var(--text-muted)] mb-1">Примечание</span><input value={editing.inputs.note || ""} onChange={e => setEditing({ ...editing, inputs: { ...editing.inputs, note: e.target.value } })} className={input} /></label>
            </div>
            <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Начислено</span><b className="tabular-nums">{fmt(preview.gross)}</b></div>
              <div className="flex justify-between text-[var(--text-muted)]"><span>Взносы работника</span><span className="tabular-nums">−{fmt(preview.sfEmployee)}</span></div>
              <div className="flex justify-between text-[var(--text-muted)]"><span>Подоходный налог (база {fmt(preview.taxable)})</span><span className="tabular-nums">−{fmt(preview.incomeTax)}</span></div>
              <div className="flex justify-between text-[var(--text-muted)]"><span>Удержания и аванс</span><span className="tabular-nums">−{fmt(editing.inputs.otherDeductions + editing.inputs.advance)}</span></div>
              <div className="flex justify-between font-black border-t border-[var(--border-color)] pt-1"><span>К выплате</span><span className="tabular-nums" data-testid="edit-preview-topay">{fmt(preview.toPay)} {cur}</span></div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-[var(--border-color)]">
              <button onClick={() => setEditing(null)} disabled={busy} className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] font-bold text-sm">Отмена</button>
              <button onClick={() => void saveInputs()} disabled={busy} data-testid="edit-save" className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
