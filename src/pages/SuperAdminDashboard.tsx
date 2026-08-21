import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Key, 
  ShieldAlert, 
  Activity, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Server, 
  BarChart3, 
  Zap, 
  Copy, 
  Check, 
  ExternalLink,
  Users,
  FileCheck,
  RefreshCw,
  Sliders,
  Eye
} from "lucide-react";

interface TenantItem {
  id: string;
  slug: string;
  name: string;
  plan: "trial" | "pro" | "enterprise";
  status: "active" | "suspended";
  maxStudents: number;
  activeStudents: number;
  proctoringEnabled: boolean;
  apiKey: string;
  createdAt: string;
  gasUrl?: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  orgId: string;
  orgName: string;
  action: string;
  details: string;
  severity: "info" | "warning" | "danger" | "success";
}

// Initial Mock Tenants for Demonstration
const MOCK_TENANTS: TenantItem[] = [
  {
    id: "grand-circle-central-asia",
    slug: "grand-circle",
    name: "Grand Circle Central Asia",
    plan: "enterprise",
    status: "active",
    maxStudents: 2500,
    activeStudents: 142,
    proctoringEnabled: true,
    apiKey: "gc_live_9f8d7c6b5a4e3f21",
    createdAt: "2026-01-15T10:00:00Z",
    gasUrl: "https://script.google.com/macros/s/AKfycbymI1U53.../exec"
  },
  {
    id: "bishkek-int-school",
    slug: "bis-edu",
    name: "Бишкекская Международная Школа #1",
    plan: "pro",
    status: "active",
    maxStudents: 500,
    activeStudents: 38,
    proctoringEnabled: true,
    apiKey: "bis_live_8a7b6c5d4e3f21a0",
    createdAt: "2026-02-01T14:30:00Z"
  },
  {
    id: "oxford-lang-center",
    slug: "oxford-kg",
    name: "Языковой Центр Oxford Academy",
    plan: "pro",
    status: "active",
    maxStudents: 300,
    activeStudents: 19,
    proctoringEnabled: true,
    apiKey: "oxf_live_1a2b3c4d5e6f7a8b",
    createdAt: "2026-02-10T09:15:00Z"
  },
  {
    id: "almaty-stem-academy",
    slug: "stem-kaz",
    name: "Almaty STEM Lyceum",
    plan: "trial",
    status: "active",
    maxStudents: 100,
    activeStudents: 4,
    proctoringEnabled: false,
    apiKey: "stem_trial_9a8b7c6d5e4f3a2b",
    createdAt: "2026-02-18T16:45:00Z"
  }
];

const INITIAL_LOGS: AuditLog[] = [
  {
    id: "log_101",
    timestamp: new Date(Date.now() - 1000 * 45).toLocaleTimeString(),
    orgId: "grand-circle-central-asia",
    orgName: "Grand Circle Central Asia",
    action: "PROCTORING_EVIDENCE_UPLOAD",
    details: "Загружено 6 скриншотов нарушений (shortId: 570490)",
    severity: "warning"
  },
  {
    id: "log_102",
    timestamp: new Date(Date.now() - 1000 * 180).toLocaleTimeString(),
    orgId: "bishkek-int-school",
    orgName: "Бишкекская Международная Школа #1",
    action: "TEST_SESSION_START",
    details: "Начато 12 новых сессий экзамена (Класс 9)",
    severity: "info"
  },
  {
    id: "log_103",
    timestamp: new Date(Date.now() - 1000 * 420).toLocaleTimeString(),
    orgId: "oxford-lang-center",
    orgName: "Языковой Центр Oxford Academy",
    action: "SUBMISSION_COMPLETED",
    details: "Ученик Айтматов М. завершил тест с баллом 42/50",
    severity: "success"
  },
  {
    id: "log_104",
    timestamp: new Date(Date.now() - 1000 * 900).toLocaleTimeString(),
    orgId: "grand-circle-central-asia",
    orgName: "Grand Circle Central Asia",
    action: "API_KEY_AUTHENTICATED",
    details: "Успешная валидация ключа server.ts -> GAS",
    severity: "info"
  }
];

export default function SuperAdminDashboard() {
  const [tenants, setTenants] = useState<TenantItem[]>(MOCK_TENANTS);
  const [logs, setLogs] = useState<AuditLog[]>(INITIAL_LOGS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<"organizations" | "logs" | "apikeys" | "analytics">("organizations");
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // New Tenant Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgPlan, setNewOrgPlan] = useState<"trial" | "pro" | "enterprise">("pro");
  const [newOrgMaxStudents, setNewOrgMaxStudents] = useState("500");

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    const slug = newOrgSlug.trim() || newOrgName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const newTenant: TenantItem = {
      id: slug + "-" + Date.now().toString(36),
      slug,
      name: newOrgName,
      plan: newOrgPlan,
      status: "active",
      maxStudents: parseInt(newOrgMaxStudents) || 500,
      activeStudents: 0,
      proctoringEnabled: true,
      apiKey: `${slug.slice(0, 4)}_live_${Math.random().toString(36).slice(2, 12)}`,
      createdAt: new Date().toISOString()
    };

    setTenants([newTenant, ...tenants]);

    // Add Audit Log
    setLogs([
      {
        id: "log_" + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        orgId: newTenant.id,
        orgName: newTenant.name,
        action: "TENANT_CREATED",
        details: `Создана новая организация. Тариф: ${newTenant.plan.toUpperCase()}, Лимит: ${newTenant.maxStudents} учеников`,
        severity: "success"
      },
      ...logs
    ]);

    setIsAddModalOpen(false);
    setNewOrgName("");
    setNewOrgSlug("");
  };

  const toggleTenantStatus = (id: string) => {
    setTenants(tenants.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === "active" ? "suspended" : "active";
        setLogs([
          {
            id: "log_" + Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            orgId: t.id,
            orgName: t.name,
            action: "TENANT_STATUS_CHANGED",
            details: `Статус изменён на: ${nextStatus.toUpperCase()}`,
            severity: nextStatus === "suspended" ? "danger" : "info"
          },
          ...logs
        ]);
        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  const toggleProctoring = (id: string) => {
    setTenants(tenants.map(t => {
      if (t.id === id) {
        return { ...t, proctoringEnabled: !t.proctoringEnabled };
      }
      return t;
    }));
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-black">
      
      {/* ── TOP SAAS NAVIGATION HEADER ── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 p-[1.5px] flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Server className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-sm tracking-tight text-white uppercase">SaaS Cloud Super-Admin</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">Vercel Multi-Tenant</span>
              </div>
              <p className="text-[11px] text-slate-400">Управление организациями, ИИ-прокторингом и API-ключами</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить организацию</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* ── METRICS OVERVIEW BENTO GRID ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden backdrop-blur-xl group hover:border-cyan-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Всего организаций</span>
              <Building2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-black text-white">{tenants.length}</div>
            <div className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>{tenants.filter(t => t.status === "active").length} активны</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden backdrop-blur-xl group hover:border-indigo-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Активные тесты LIVE</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white">
              {tenants.reduce((acc, t) => acc + t.activeStudents, 0)}
            </div>
            <div className="text-[11px] text-indigo-300 mt-2 flex items-center gap-1 font-mono">
              <Activity className="w-3 h-3 text-indigo-400 animate-pulse" />
              <span>нагрузка в норме</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden backdrop-blur-xl group hover:border-purple-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Детектор ИИ Прокторинга</span>
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-black text-purple-400">100%</div>
            <div className="text-[11px] text-purple-300 mt-2 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-purple-400" />
              <span>MediaPipe GPU / Canvas HD</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden backdrop-blur-xl group hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Статус Серверов</span>
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400">ONLINE</div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span>
              <span>Vercel Edge API: 24ms</span>
            </div>
          </div>
        </div>

        {/* ── NAVIGATION TABS & SEARCH BAR ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 w-full sm:w-auto">
            <button
              onClick={() => setSelectedTab("organizations")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                selectedTab === "organizations" 
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Организации ({tenants.length})</span>
            </button>
            <button
              onClick={() => setSelectedTab("logs")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                selectedTab === "logs" 
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Логи & Аудит ({logs.length})</span>
            </button>
            <button
              onClick={() => setSelectedTab("apikeys")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                selectedTab === "apikeys" 
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>API Ключи SaaS</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Поиск организации..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all font-medium"
            />
          </div>
        </div>

        {/* ── TAB 1: ORGANIZATIONS MANAGER ── */}
        {selectedTab === "organizations" && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800 tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Организация / Школа</th>
                      <th className="py-3.5 px-4">Тарифный план</th>
                      <th className="py-3.5 px-4">Учеников (Слоты)</th>
                      <th className="py-3.5 px-4">ИИ Прокторинг</th>
                      <th className="py-3.5 px-4">Статус</th>
                      <th className="py-3.5 px-4">API Ключ</th>
                      <th className="py-3.5 px-4 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredTenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-4 font-semibold text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-bold font-mono">
                              {tenant.name[0]}
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm">{tenant.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">slug: {tenant.slug}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase border ${
                            tenant.plan === "enterprise"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                              : tenant.plan === "pro"
                              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}>
                            {tenant.plan}
                          </span>
                        </td>

                        <td className="py-4 px-4 font-mono">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold">{tenant.activeStudents}</span>
                            <span className="text-slate-500">/ {tenant.maxStudents}</span>
                          </div>
                          <div className="w-24 bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div 
                              className="bg-cyan-400 h-full rounded-full" 
                              style={{ width: `${Math.min(100, (tenant.activeStudents / tenant.maxStudents) * 100)}%` }}
                            />
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <button
                            onClick={() => toggleProctoring(tenant.id)}
                            className={`px-3 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${
                              tenant.proctoringEnabled 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                            }`}
                          >
                            <Zap className="w-3 h-3" />
                            <span>{tenant.proctoringEnabled ? "Включён" : "Выключён"}</span>
                          </button>
                        </td>

                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            tenant.status === "active" ? "text-emerald-400" : "text-red-400"
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${
                              tenant.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                            }`} />
                            {tenant.status === "active" ? "Активна" : "Приостановлена"}
                          </span>
                        </td>

                        <td className="py-4 px-4 font-mono text-[11px]">
                          <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 w-fit">
                            <span className="text-slate-400">{tenant.apiKey.slice(0, 10)}...</span>
                            <button 
                              onClick={() => copyToClipboard(tenant.apiKey, tenant.id)}
                              className="text-slate-500 hover:text-cyan-400 transition"
                              title="Скопировать API ключ"
                            >
                              {copiedKeyId === tenant.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => toggleTenantStatus(tenant.id)}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                              tenant.status === "active" 
                                ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {tenant.status === "active" ? "Заблокировать" : "Активировать"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: AUDIT LOGS STREAM ── */}
        {selectedTab === "logs" && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Поток Аудит-Логов Системы</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">Все события прокторинга, генерации справок и авторизаций организаций</p>
              </div>
              <button 
                onClick={() => setLogs([...logs])}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition"
                title="Обновить логи"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 font-mono text-xs max-h-[500px] overflow-y-auto pr-2">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${
                    log.severity === "warning"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                      : log.severity === "danger"
                      ? "bg-red-500/10 border-red-500/30 text-red-200"
                      : log.severity === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                      : "bg-slate-950/80 border-slate-800 text-slate-300"
                  }`}
                >
                  <div className="text-slate-500 text-[11px] whitespace-nowrap pt-0.5 font-bold">
                    [{log.timestamp}]
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="text-cyan-400">[{log.orgName}]</span>
                      <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {log.action}
                      </span>
                    </div>
                    <div className="mt-1 text-slate-200 font-sans text-xs">{log.details}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: API KEYS & INTEGRATIONS ── */}
        {selectedTab === "apikeys" && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-2xl space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                <span>Управление Ключами Безопасности SaaS</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">Ключи доступа для интеграции прокторинга в сторонние приложения школ и вузов</p>
            </div>

            <div className="space-y-4">
              {tenants.map(t => (
                <div key={t.id} className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-white text-sm">{t.name}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">Org ID: {t.id}</div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
                    <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg font-mono text-xs text-cyan-300">
                      {t.apiKey}
                    </div>
                    <button
                      onClick={() => copyToClipboard(t.apiKey, t.id)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                    >
                      {copiedKeyId === t.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKeyId === t.id ? "Скопирован" : "Копировать"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ── MODAL: CREATE NEW ORGANIZATION ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                <span>Добавить организацию</span>
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-500 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Название организации / Школы
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="например: Школа №67 г. Бишкек"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Уникальный Slug (URL Идентификатор)
                </label>
                <input 
                  type="text"
                  placeholder="например: bishkek-school-67"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Тарифный План
                  </label>
                  <select
                    value={newOrgPlan}
                    onChange={(e: any) => setNewOrgPlan(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                  >
                    <option value="trial">Trial (Бесплатный)</option>
                    <option value="pro">Pro (Стандарт)</option>
                    <option value="enterprise">Enterprise (Макс)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Лимит Учеников
                  </label>
                  <input 
                    type="number"
                    value={newOrgMaxStudents}
                    onChange={(e) => setNewOrgMaxStudents(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                >
                  Создать и выдать API Ключ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
