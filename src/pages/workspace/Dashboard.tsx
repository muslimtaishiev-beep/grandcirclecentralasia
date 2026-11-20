import React from "react";
import { useOutletContext, Link, useParams } from "react-router-dom";
import { Users, FileText, CheckSquare, TrendingUp, ArrowRight, AlertTriangle, UserCheck, ClipboardCheck, MailWarning, Inbox, Landmark, Building2, Layers } from "lucide-react";
import { resolveWorkspaceConfig } from "../../shared/workspaceConfig";
import { Button, EmptyState, PageHeader, Spinner } from "../../components/ui";
import { useDashboard } from "./dashboard/useDashboard";
import { Panel, Stat, fmt } from "./dashboard/parts";

interface Attention { key: string; label: string; count: number; to: string; icon: React.ReactNode }

export default function WorkspaceDashboard() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId: paramOrg } = useParams();
  const orgId: string | undefined = activeTenant?.id || paramOrg;
  const [state, reload] = useDashboard(orgId);
  const base = `/workspace/${orgId}`;
  const cfg = resolveWorkspaceConfig(activeTenant?.workspaceConfig);

  if (!orgId) {
    return <EmptyState icon={<Building2 className="w-8 h-8" />} title="Организация не выбрана" action={<Link to="/workspace"><Button variant="primary">К списку организаций</Button></Link>} />;
  }

  const name = activeTenant?.name && !String(activeTenant.name).startsWith("org_") ? activeTenant.name : "";
  const header = <PageHeader title={cfg.dashboardTitle || name || "Главная"} />;

  if (state.status === "loading") return <div className="max-w-7xl mx-auto w-full">{header}<div className="py-16 flex justify-center"><Spinner /></div></div>;
  if (state.status === "error") {
    return (
      <div className="max-w-7xl mx-auto w-full">
        {header}
        <EmptyState icon={<AlertTriangle className="w-8 h-8 text-rose-600" />} title={state.message} action={<Button variant="primary" onClick={reload}>Повторить</Button>} />
      </div>
    );
  }

  const b = state.blocks;
  const attention: Attention[] = [];
  if (b.admissions?.ok && b.admissions.undecided > 0) attention.push({ key: "adm", label: "Поступающие без решения", count: b.admissions.undecided, to: `${base}/admissions`, icon: <UserCheck className="w-4 h-4" /> });
  if (b.exams?.ok && (b.exams.unreviewed ?? 0) > 0) attention.push({ key: "rev", label: "Непроверенные работы", count: b.exams.unreviewed as number, to: `${base}/exams`, icon: <ClipboardCheck className="w-4 h-4" /> });
  if (b.emails?.ok && b.emails.failed > 0) attention.push({ key: "mail", label: "Письма не ушли", count: b.emails.failed, to: `${base}/settings/emails?tab=log`, icon: <MailWarning className="w-4 h-4" /> });
  if (b.forms?.ok && b.forms.unanswered > 0) attention.push({ key: "forms", label: "Заявки без ответа", count: b.forms.unanswered, to: `${base}/builder/forms`, icon: <Inbox className="w-4 h-4" /> });
  const failedBlocks = (Object.keys(b) as (keyof typeof b)[]).filter(k => b[k] && !b[k]!.ok);

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <PageHeader title={cfg.dashboardTitle || name || "Главная"} />
      {cfg.dashboardSubtitle && <p className="-mt-2 text-sm text-[var(--text-muted)]">{cfg.dashboardSubtitle}</p>}

      {(attention.length > 0 || failedBlocks.some(k => ["admissions", "emails", "forms"].includes(k))) && (
        <Panel title="Требует внимания">
          <div className="flex flex-wrap gap-2">
            {attention.map(a => (
              <Link key={a.key} to={a.to}>
                <Button variant="secondary" icon={a.icon}>{a.label}<span className="ml-1 rounded-full bg-rose-600 text-white px-2 text-xs tabular-nums">{a.count}</span></Button>
              </Link>
            ))}
            {failedBlocks.some(k => ["admissions", "emails", "forms"].includes(k)) && <Button variant="ghost" icon={<AlertTriangle className="w-4 h-4 text-rose-600" />} onClick={reload}>Часть сводки не загрузилась — повторить</Button>}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {b.members && <Stat title="Сотрудники" icon={<Users className="w-5 h-5" />} to={`${base}/settings/team`} block={b.members} pick={x => x.count} onRetry={reload} />}
        {b.exams && (b.exams.ok ? b.exams.openExams !== undefined : true) && (
          <Stat title="Экзамены открыты" icon={<FileText className="w-5 h-5" />} to={`${base}/exams`} block={b.exams} pick={x => x.openExams ?? 0}
            sub={x => <>{x.inProgress ? `Пишут сейчас: ${x.inProgress}` : `Всего: ${x.totalExams ?? 0}`}</>} onRetry={reload} />
        )}
        {b.deals && <Stat title="Сделки в работе" icon={<TrendingUp className="w-5 h-5" />} to={`${base}/crm/deals`} block={b.deals} pick={x => x.open} sub={x => (x.amount ? fmt(x.amount) : "")} onRetry={reload} />}
        {b.tasks && <Stat title="Открытые задачи" icon={<CheckSquare className="w-5 h-5" />} to={`${base}/tasks`} block={b.tasks} pick={x => x.open} sub={x => `Мои: ${x.mineCount}`} onRetry={reload} />}
        {b.admissions && <Stat title="Поступающие" icon={<Layers className="w-5 h-5" />} to={`${base}/admissions`} block={b.admissions} pick={x => x.total} onRetry={reload} />}
      </div>

      {b.tasks && (
        <Panel title="Мои задачи" action={<Link to={`${base}/tasks`}><Button size="sm" variant="secondary" icon={<ArrowRight className="w-4 h-4" />}>Все задачи</Button></Link>}>
          {!b.tasks.ok ? (
            <div className="flex items-center gap-2 text-sm text-rose-600"><AlertTriangle className="w-4 h-4" /> Не загрузилось <Button size="sm" variant="secondary" onClick={reload}>Повторить</Button></div>
          ) : b.tasks.mine.length === 0 ? (
            <EmptyState title="Задач нет" />
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {b.tasks.mine.map(t => {
                const late = !!t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10);
                return (
                  <li key={t.id}>
                    <Link to={`${base}/tasks`} className="flex items-center gap-3 py-2.5 hover:bg-[var(--bg-surface-hover)] px-2 rounded-lg">
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-main)]">{t.title}</span>
                      {t.dueDate && <span className={`text-xs tabular-nums ${late ? "text-rose-600 font-semibold" : "text-[var(--text-muted)]"}`}>{t.dueDate.split("-").reverse().join(".")}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {b.finance && (
        <Panel title="Касса" action={b.finance.ok ? <Link to={`${base}/edu/payroll`}><Button size="sm" variant="secondary" icon={<Landmark className="w-4 h-4" />}>Касса и зарплаты</Button></Link> : undefined}>
          {!b.finance.ok ? (
            <div className="flex items-center gap-2 text-sm text-rose-600"><AlertTriangle className="w-4 h-4" /> Не загрузилось <Button size="sm" variant="secondary" onClick={reload}>Повторить</Button></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {([["Поступления", b.finance.cash, ""], ["Договоры за год", b.finance.contracts, `${b.finance.accepted}`], ["ФОТ", b.finance.payroll, ""], ["Баланс", b.finance.net, b.finance.net < 0 ? "neg" : ""]] as [string, number, string][]).map(([l, v, x]) => (
                <div key={l} className="rounded-xl border border-[var(--border-color)] p-4">
                  <div className="text-[11px] uppercase font-semibold text-[var(--text-muted)]">{l}</div>
                  <div className={`text-2xl font-black tabular-nums mt-1 ${x === "neg" ? "text-rose-600" : "text-[var(--text-main)]"}`}>{fmt(v)}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
