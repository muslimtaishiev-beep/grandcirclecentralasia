import { resolveWorkspaceConfig } from "../../shared/workspaceConfig";
import React, { useEffect, useState } from "react";
import { useOutletContext, Link, useParams } from "react-router-dom";
import { Users, FileText, CheckSquare, Layers, TrendingUp, ArrowRight, ShieldCheck, Zap, Landmark } from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";

export default function WorkspaceDashboard() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { orgId } = useParams();

  const [stats, setStats] = useState({
    membersCount: 0,
    testsCount: 0,
    dealsCount: 0,
    tasksCount: 0,
    docsCount: 0
  });

  const [financeSummary, setFinanceSummary] = useState<{
    totalCashCollected: number;
    totalInitialFees: number;
    totalMonthlyPaid: number;
    totalContractValue: number;
    acceptedCount: number;
    totalPayroll: number;
    netBalance: number;
  }>({
    totalCashCollected: 0,
    totalInitialFees: 0,
    totalMonthlyPaid: 0,
    totalContractValue: 0,
    acceptedCount: 0,
    totalPayroll: 0,
    netBalance: 0
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    (async () => {
      const { getCountFromServer } = await import("firebase/firestore");
      const countOf = async (col: string) => {
        try {
          const snap = await getCountFromServer(query(collection(db, col), where("tenantId", "==", orgId)));
          return snap.data().count;
        } catch {
          return 0;   // коллекции может не быть — это не ошибка экрана
        }
      };
      const [membersCount, testsCount, dealsCount, tasksCount, docsCount] = await Promise.all([
        countOf("memberships"), countOf("tests"), countOf("crm_deals"),
        countOf("tasks"), countOf("documents"),
      ]);
      if (cancelled) return;
      setStats({ membersCount, testsCount, dealsCount, tasksCount, docsCount });

      // Fetch financial summary for tenant dashboard
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
        const res = await fetch(`/api/tenant/finance-summary?tenantId=${encodeURIComponent(orgId)}`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
        const j = await res.json();
        if (!cancelled && j && j.success) {
          setFinanceSummary({
            totalCashCollected: j.totalCashCollected || 0,
            totalInitialFees: j.totalInitialFees || 0,
            totalMonthlyPaid: j.totalMonthlyPaid || 0,
            totalContractValue: j.totalContractValue || 0,
            acceptedCount: j.acceptedCount || 0,
            totalPayroll: j.totalPayroll || 0,
            netBalance: j.netBalance || 0
          });
        }
      } catch (e) {
        console.warn("[WorkspaceDashboard] Finance fetch error:", e);
      }

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [orgId]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[var(--bg-surface)] via-[var(--bg-app)] to-[var(--bg-surface)] border border-[var(--border-color)] p-8 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--accent)] font-bold uppercase tracking-wider mb-2">
            <Zap className="w-4 h-4" /> {activeTenant?.name && !activeTenant.name.startsWith("org_") ? activeTenant.name : "Ваша организация"}
          </div>
          <h1 className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
            {resolveWorkspaceConfig(activeTenant?.workspaceConfig).dashboardTitle}
          </h1>
          <p className="text-[var(--text-muted)] mt-2 max-w-2xl text-sm leading-relaxed">
            {resolveWorkspaceConfig(activeTenant?.workspaceConfig).dashboardSubtitle}
          </p>
        </div>
      </div>

      {/* Financial Analytics Widget of Tenant */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-main)]">Финансовый свод и Касса организации</h2>
              <p className="text-xs text-[var(--text-muted)]">Синхронизированные данные поступлений от учеников и расходов на зарплаты</p>
            </div>
          </div>
          <Link
            to={`/workspace/${orgId}/edu/payroll`}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 transition"
          >
            <span>Кассовая книга и Зарплаты</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="bg-[var(--bg-app)] border border-emerald-500/30 p-4 rounded-xl">
            <div className="text-[11px] font-mono uppercase font-bold text-emerald-600">Касса (Фактически)</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {financeSummary.totalCashCollected.toLocaleString("ru-RU")} сом
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1">
              Взносы ({financeSummary.totalInitialFees.toLocaleString("ru-RU")}) + Помесячно ({financeSummary.totalMonthlyPaid.toLocaleString("ru-RU")})
            </div>
          </div>

          <div className="bg-[var(--bg-app)] border border-[var(--border-color)] p-4 rounded-xl">
            <div className="text-[11px] font-mono uppercase font-bold text-[var(--text-muted)]">Договоры за год (со скидкой)</div>
            <div className="text-2xl font-black text-[var(--text-main)] mt-1">
              {financeSummary.totalContractValue.toLocaleString("ru-RU")} сом
            </div>
            <div className="text-[11px] text-blue-500 font-medium mt-1">Годовой объем ({financeSummary.acceptedCount} учеников)</div>
          </div>

          <div className="bg-[var(--bg-app)] border border-[var(--border-color)] p-4 rounded-xl">
            <div className="text-[11px] font-mono uppercase font-bold text-[var(--text-muted)]">ФОТ Зарплат</div>
            <div className="text-2xl font-black text-purple-500 mt-1">
              {financeSummary.totalPayroll.toLocaleString("ru-RU")} сом
            </div>
            <div className="text-[11px] text-purple-500 font-medium mt-1">Расходы на сотрудников</div>
          </div>

          <div className="bg-[var(--bg-app)] border border-[var(--border-color)] p-4 rounded-xl">
            <div className="text-[11px] font-mono uppercase font-bold text-[var(--text-muted)]">Чистый баланс кассы</div>
            <div className={`text-2xl font-black mt-1 ${financeSummary.netBalance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {financeSummary.netBalance.toLocaleString("ru-RU")} сом
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1">Касса (факт) − ФОТ</div>
          </div>
        </div>
      </div>

      {/* Real-time Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Members */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-6 shadow-sm hover:border-[var(--accent)] transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] font-mono text-xs uppercase font-semibold">Сотрудники</span>
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[var(--text-main)]">{loading ? "..." : stats.membersCount}</div>
          <p className="text-xs text-[var(--text-muted)] mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Члены команды
          </p>
        </div>

        {/* Tests */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-6 shadow-sm hover:border-[var(--accent)] transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] font-mono text-xs uppercase font-semibold">Активные Тесты</span>
            <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[var(--text-main)]">{loading ? "..." : stats.testsCount}</div>
          <p className="text-xs text-[var(--text-muted)] mt-2">Экзамены с AI Прокторингом</p>
        </div>

        {/* CRM Deals */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-6 shadow-sm hover:border-[var(--accent)] transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] font-mono text-xs uppercase font-semibold">Сделки в CRM</span>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[var(--text-main)]">{loading ? "..." : stats.dealsCount}</div>
          <p className="text-xs text-[var(--text-muted)] mt-2">Воронка продаж и лиды</p>
        </div>

        {/* Tasks */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-6 shadow-sm hover:border-[var(--accent)] transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] font-mono text-xs uppercase font-semibold">Задачи</span>
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-lg">
              <CheckSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[var(--text-main)]">{loading ? "..." : stats.tasksCount}</div>
          <p className="text-xs text-[var(--text-muted)] mt-2">В работе и выполнено</p>
        </div>

      </div>

      {/* Quick Access Grid */}
      <div>
        <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Быстрый переход к модулям</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          <Link 
            to={`/workspace/${orgId}/tests/manage`}
            className="bg-emerald-950/30 border border-emerald-800/60 p-5 rounded-xl hover:border-emerald-500 transition group flex items-center justify-between"
          >
            <div>
              <div className="font-bold text-emerald-400 group-hover:text-emerald-300 transition flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Проверка Тестов Менеджером</span>
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Ответы абитуриентов, видео прокторинга и PDF отчеты</div>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition" />
          </Link>

          <Link 
            to={`/workspace/${orgId}/tests`}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-xl hover:border-[var(--accent)] transition group flex items-center justify-between"
          >
            <div>
              <div className="font-bold text-[var(--text-main)] group-hover:text-[var(--accent)] transition">Все Тесты и Экзамены</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Создание тестов, банк вопросов и прокторинг</div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition" />
          </Link>

          <Link 
            to={`/workspace/${orgId}/crm/deals`}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-xl hover:border-[var(--accent)] transition group flex items-center justify-between"
          >
            <div>
              <div className="font-bold text-[var(--text-main)] group-hover:text-[var(--accent)] transition">CRM и Воронка</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Сделки, контакты и WhatsApp сообщения</div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition" />
          </Link>

        </div>
      </div>

    </div>
  );
}
