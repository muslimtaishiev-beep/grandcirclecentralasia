import React, { useEffect, useState } from "react";
import { useOutletContext, Link, useParams } from "react-router-dom";
import { Users, FileText, CheckSquare, Layers, TrendingUp, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function WorkspaceDashboard() {
  const { activeTenant } = useOutletContext<any>();
  const { orgId } = useParams();

  const [stats, setStats] = useState({
    membersCount: 0,
    testsCount: 0,
    dealsCount: 0,
    tasksCount: 0,
    docsCount: 0
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;

    // Subscriptions for real-time tenant stats
    const qMembers = query(collection(db, "memberships"), where("tenantId", "==", orgId));
    const qTests = query(collection(db, "tests"), where("tenantId", "==", orgId));
    const qDeals = query(collection(db, "crm_deals"), where("tenantId", "==", orgId));
    const qTasks = query(collection(db, "tasks"), where("tenantId", "==", orgId));
    const qDocs = query(collection(db, "documents"), where("tenantId", "==", orgId));

    const unsubMembers = onSnapshot(qMembers, snap => {
      setStats(prev => ({ ...prev, membersCount: snap.size }));
    });
    const unsubTests = onSnapshot(qTests, snap => {
      setStats(prev => ({ ...prev, testsCount: snap.size }));
    });
    const unsubDeals = onSnapshot(qDeals, snap => {
      setStats(prev => ({ ...prev, dealsCount: snap.size }));
    });
    const unsubTasks = onSnapshot(qTasks, snap => {
      setStats(prev => ({ ...prev, tasksCount: snap.size }));
    });
    const unsubDocs = onSnapshot(qDocs, snap => {
      setStats(prev => ({ ...prev, docsCount: snap.size }));
      setLoading(false);
    });

    return () => {
      unsubMembers();
      unsubTests();
      unsubDeals();
      unsubTasks();
      unsubDocs();
    };
  }, [orgId]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[var(--bg-surface)] via-[var(--bg-app)] to-[var(--bg-surface)] border border-[var(--border-color)] p-8 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--accent)] font-bold uppercase tracking-wider mb-2">
            <Zap className="w-4 h-4" /> Активный Воркспейс • {activeTenant?.name || "Организация"}
          </div>
          <h1 className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
            Добро пожаловать в панель управления
          </h1>
          <p className="text-[var(--text-muted)] mt-2 max-w-2xl text-sm leading-relaxed">
            Воркспейс полностью изолирован и работает на защищённой мульти-тенантной архитектуре. Ниже представлена аналитика в реальном времени.
          </p>
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
            to={`/workspace/${orgId}/crm/deals`}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-xl hover:border-[var(--accent)] transition group flex items-center justify-between"
          >
            <div>
              <div className="font-bold text-[var(--text-main)] group-hover:text-[var(--accent)] transition">CRM Воронка</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Сделки, контакты и WhatsApp интеграция</div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition" />
          </Link>

          <Link 
            to={`/workspace/${orgId}/tests`}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-xl hover:border-[var(--accent)] transition group flex items-center justify-between"
          >
            <div>
              <div className="font-bold text-[var(--text-main)] group-hover:text-[var(--accent)] transition">Конструктор Тестов</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Создание экзаменов и настройка AI прокторинга</div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition" />
          </Link>

          <Link 
            to={`/workspace/${orgId}/docs`}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-xl hover:border-[var(--accent)] transition group flex items-center justify-between"
          >
            <div>
              <div className="font-bold text-[var(--text-main)] group-hover:text-[var(--accent)] transition">Совместные Документы</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">База знаний TipTap + Yjs в реальном времени</div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition" />
          </Link>

        </div>
      </div>

    </div>
  );
}
