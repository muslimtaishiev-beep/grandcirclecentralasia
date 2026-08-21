import React, { useState, useEffect } from "react";
import { 
  Folder, 
  Terminal, 
  Database, 
  Sliders, 
  Settings, 
  Plus, 
  Search, 
  Check, 
  Copy, 
  ExternalLink, 
  Activity, 
  RefreshCw,
  HardDrive,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck
} from "lucide-react";
import { collection, onSnapshot, updateDoc, doc, query, orderBy, limit } from "firebase/firestore";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { db, auth } from "../lib/firebase";
import { TenantRequestsTab } from "../components/superadmin/TenantRequestsTab";

interface OrganizationProject {
  id: string;
  name: string;
  slug: string;
  framework: string;
  status: "READY font-mono" | "BUILDING" | "ERROR" | "SUSPENDED";
  updatedAt: string;
  domain: string;
  activeSessions: number;
  totalSubmissions: number;
  storageUsedMb: number;
  apiKey: string;
  proctoringFlags: {
    gazeAway: boolean;
    faceCount: boolean;
    handTracking: boolean;
    audioAnalysis: boolean;
    phoneDetection: boolean;
  };
}

interface VercelSystemLog {
  id: string;
  timestamp: string;
  orgSlug: string;
  level: "INFO" | "WARN" | "ERROR" | "SUCCESS";
  route: string;
  message: string;
  durationMs: number;
}

export default function SuperAdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(auth.currentUser || localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token"));
  });
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        setIsAuthenticated(true);
      }
    });
    return () => unsub();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError("");
    try {
      const userCred = await signInWithEmailAndPassword(auth, adminEmailInput, adminPasswordInput);
      const user = userCred.user;
      const idToken = await user.getIdToken();

      // Verify token with backend
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem("admin_token", idToken);
        sessionStorage.setItem("admin_token", idToken);
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || "Ошибка авторизации в Firebase Auth");
      }
    } catch (err: any) {
      setAuthError(err.message || "Ошибка входа через Firebase Auth. Проверьте Email и пароль.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_token");
    setIsAuthenticated(false);
  };

  const [projects, setProjects] = useState<OrganizationProject[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [logs, setLogs] = useState<VercelSystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"projects" | "deployments" | "logs" | "storage" | "flags" | "settings" | "requests">("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Maintenance Mode Control State
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("Идут плановые технические работы по обновлению серверов прокторинга. Доступ будет восстановлен в ближайшее время.");
  const [maintenanceTime, setMaintenanceTime] = useState("30-45 минут");
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
  const [maintenanceSuccess, setMaintenanceSuccess] = useState(false);

  // Subscribe to live Firestore collections (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);

    // 1. Subscribe to /tenants
    const unsubTenants = onSnapshot(collection(db, "tenants"), (snapshot) => {
      const docs: OrganizationProject[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        docs.push({
          id: d.id,
          name: data.name || "Организация",
          slug: data.slug || d.id,
          framework: "SaaS Enterprise Engine",
          status: "READY font-mono",
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toLocaleTimeString() : "Недавно",
          domain: data.domain || `${data.slug || d.id}.edu.kg`,
          activeSessions: data.activeSessions || 0,
          totalSubmissions: data.totalSubmissions || 0,
          storageUsedMb: data.storageUsedMb || 120,
          apiKey: data.apiKey || `key_${d.id}_live`,
          proctoringFlags: data.proctoringFlags || {
            gazeAway: true,
            faceCount: true,
            handTracking: true,
            audioAnalysis: true,
            phoneDetection: true
          }
        });
      });

      // Default fallback if no tenants in Firestore yet
      if (docs.length === 0) {
        docs.push({
          id: "org_future_leaders",
          name: "ОсОО «Академия Будущих Лидеров»",
          slug: "future-leaders",
          framework: "SaaS Enterprise Engine",
          status: "READY font-mono",
          updatedAt: "Только что",
          domain: "futureleaders.edu.kg",
          activeSessions: 5,
          totalSubmissions: 420,
          storageUsedMb: 350,
          apiKey: "fl_live_key_9f8d7c",
          proctoringFlags: {
            gazeAway: true,
            faceCount: true,
            handTracking: true,
            audioAnalysis: true,
            phoneDetection: true
          }
        });
      }

      setProjects(docs);
      setLoading(false);
    }, (err) => {
      console.warn("[SuperAdmin] Tenants listener error:", err.message);
      setLoading(false);
    });

    // 2. Subscribe to /exam_sessions
    const unsubSessions = onSnapshot(collection(db, "exam_sessions"), (snapshot) => {
      const active: any[] = [];
      snapshot.forEach(d => {
        const data = d.data();
        if (data.status === "active" || data.status === "in_progress") {
          active.push({ id: d.id, ...data });
        }
      });
      setLiveSessions(active);
    }, (err) => {
      console.warn("[SuperAdmin] Sessions listener error:", err.message);
    });

    // 3. Fetch Maintenance status
    fetch("/api/public/maintenance")
      .then(res => res.json())
      .then(data => {
        if (data) {
          setMaintenanceEnabled(Boolean(data.enabled));
          if (data.message) setMaintenanceMessage(data.message);
          if (data.estimatedTime) setMaintenanceTime(data.estimatedTime);
        }
      })
      .catch(() => {});

    // 4. Subscribe to /audit_logs
    const qLogs = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(50));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const list: VercelSystemLog[] = [];
      snapshot.forEach(d => {
        const l = d.data();
        list.push({
          id: d.id,
          timestamp: l.timestamp?.toDate ? l.timestamp.toDate().toLocaleTimeString() : new Date().toLocaleTimeString(),
          orgSlug: l.target || 'system',
          level: l.action?.includes('REJECT') || l.action?.includes('ERROR') ? 'WARN' : 'SUCCESS',
          route: l.action || 'AUDIT_EVENT',
          message: `${l.userEmail || 'User'}: ${l.details || l.action}`,
          durationMs: 35
        });
      });
      setLogs(list);
    }, (err) => {
      console.warn("[SuperAdmin] Logs listener error:", err.message);
    });

    return () => {
      unsubTenants();
      unsubSessions();
      unsubLogs();
    };
  }, [isAuthenticated]);

  const handleSaveMaintenance = async (enabledState: boolean) => {
    setIsSavingMaintenance(true);
    setMaintenanceSuccess(false);
    try {
      setMaintenanceEnabled(enabledState);
      const token = sessionStorage.getItem("admin_token") || "admin";
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          enabled: enabledState,
          message: maintenanceMessage,
          estimatedTime: maintenanceTime
        })
      });
      if (res.ok) {
        setMaintenanceSuccess(true);
        setTimeout(() => setMaintenanceSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Failed to update maintenance mode", e);
    } finally {
      setIsSavingMaintenance(false);
    }
  };

  // Toggle Proctoring Feature Flags live in Firestore
  const toggleFlag = async (projectId: string, flagKey: keyof OrganizationProject["proctoringFlags"]) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;

    const updatedFlags = {
      ...proj.proctoringFlags,
      [flagKey]: !proj.proctoringFlags[flagKey]
    };

    try {
      const docRef = doc(db, "tenants", projectId);
      await updateDoc(docRef, { proctoringFlags: updatedFlags });
    } catch (err) {
      // Local state fallback if doc doesn't exist yet
      setProjects(projects.map(p => p.id === projectId ? { ...p, proctoringFlags: updatedFlags } : p));
    }
  };

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#ededed] flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-[#111111] border border-[#333333] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 bg-[#1a1a1a] border border-[#333333] rounded-xl flex items-center justify-center text-[#9F7AEA] mb-4 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#ffffff] tracking-tight uppercase">Super Admin Portal</h2>
            <p className="text-xs text-[#888888] mt-1">Доступ верховного администратора платформы</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-5">
            {authError && (
              <div className="bg-[#2a1111] border border-[#ff4444]/40 p-3.5 rounded-lg text-xs text-[#ff6666] font-medium flex items-center gap-2">
                <span>⚠️ {authError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#888888] uppercase tracking-wider mb-2">
                Email Администратора (Firebase Auth)
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  placeholder="admin@studyfreeforum.com"
                  required
                  className="w-full bg-[#000000] border border-[#333333] rounded-lg px-4 py-3 text-sm text-[#ffffff] focus:outline-none focus:border-[#9F7AEA] transition font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#888888] uppercase tracking-wider mb-2">
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-[#000000] border border-[#333333] rounded-lg px-4 py-3 text-sm text-[#ffffff] focus:outline-none focus:border-[#9F7AEA] transition pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#666666] hover:text-[#ffffff] transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 px-4 bg-[#ffffff] text-[#000000] font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-[#ededed] transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>Войти в консоль</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#000000] text-[#ededed] font-sans antialiased selection:bg-[#fff] selection:text-[#000]">
      
      {/* ── HEADER ── */}
      <header className="border-b border-[#333333] bg-[#000000] sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center">
              <svg width="16" height="14" viewBox="0 0 76 65" fill="none">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="#FFFFFF" />
              </svg>
            </div>
            <span className="text-[#444444] font-light">/</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#ffffff]">Super Admin Console</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#111111] text-[#50e3c2] border border-[#333333]">LIVE FIRESTORE</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={handleAdminLogout}
              className="flex items-center gap-1.5 text-xs text-[#ff6666] hover:text-[#ff8888] bg-[#221111] border border-[#442222] px-3 py-1.5 rounded transition font-medium cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Выйти
            </button>
          </div>
        </div>

        {/* ── TAB NAVIGATION ── */}
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex items-center gap-6 text-xs text-[#888888] border-t border-[#111111] pt-1 font-medium overflow-x-auto">
          {[
            { id: "projects", label: "Организации", icon: Folder },
            { id: "deployments", label: "Сессии Прокторинга", icon: Activity },
            { id: "requests", label: "Заявки", icon: Plus },
            { id: "logs", label: "Системный Аудит", icon: Terminal },
            { id: "storage", label: "Хранилище", icon: Database },
            { id: "flags", label: "Флаги Прокторинга", icon: Sliders },
            { id: "settings", label: "API Ключи", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? "border-[#ffffff] text-[#ffffff] font-semibold" 
                    : "border-transparent text-[#888888] hover:text-[#ededed]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ── MAIN DASHBOARD CONTAINER ── */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── MAINTENANCE BAR ── */}
        <div className={`p-5 rounded-lg border font-mono text-xs transition-all space-y-4 ${
          maintenanceEnabled 
            ? "bg-[#221a00] border-[#f5a623] text-[#f5a623]" 
            : "bg-[#0a0a0a] border-[#333333] text-[#888888]"
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                maintenanceEnabled ? "bg-[#f5a623] animate-ping" : "bg-[#444444]"
              }`} />
              <div>
                <div className="font-bold text-sm text-[#ffffff] flex items-center gap-2">
                  <span>🚨 РЕЖИМ ТЕХНИЧЕСКИХ РАБОТ</span>
                  {maintenanceEnabled && (
                    <span className="text-[10px] bg-[#f5a623]/20 border border-[#f5a623]/40 text-[#f5a623] px-2 py-0.5 rounded uppercase font-mono">
                      АКТИВЕН ДЛЯ ВСЕХ СТРАНИЦ И ШКОЛ
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end font-sans">
              {maintenanceEnabled ? (
                <button
                  onClick={() => handleSaveMaintenance(false)}
                  disabled={isSavingMaintenance}
                  className="px-4 py-2 bg-[#ff4444] hover:bg-[#dd3333] text-white font-bold rounded-md shadow transition cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <span>ВЫКЛЮЧИТЬ ТЕХРАБОТЫ</span>
                </button>
              ) : (
                <button
                  onClick={() => handleSaveMaintenance(true)}
                  disabled={isSavingMaintenance}
                  className="px-4 py-2 bg-[#f5a623] hover:bg-[#e09512] text-black font-bold rounded-md shadow transition cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <span>ВКЛЮЧИТЬ ТЕХРАБОТЫ</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── TAB 1: PROJECTS (ORGANIZATIONS) ── */}
        {activeTab === "projects" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Фильтр организаций..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#333333] rounded-md pl-9 pr-3 py-1.5 text-xs text-[#ededed] placeholder-[#666666] focus:outline-none"
                />
              </div>
              <div className="text-xs text-[#888888] font-mono">
                Всего организаций: {filteredProjects.length}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#50e3c2]" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                  <div 
                    key={project.id}
                    className="bg-[#0a0a0a] border border-[#333333] hover:border-[#666666] rounded-lg p-5 transition flex flex-col justify-between space-y-4 shadow-sm"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#50e3c2]" title="Ready" />
                          <h3 className="font-semibold text-sm text-[#ffffff]">{project.name}</h3>
                        </div>
                        <span className="text-[10px] font-mono text-[#888888] bg-[#111111] px-1.5 py-0.5 rounded border border-[#222222]">
                          {project.slug}
                        </span>
                      </div>

                      <a 
                        href={`https://${project.domain}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-[#888888] hover:text-[#ffffff] transition flex items-center gap-1 font-mono"
                      >
                        <span>{project.domain}</span>
                        <ExternalLink className="w-3 h-3 text-[#555555]" />
                      </a>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#1a1a1a] text-xs">
                      <div>
                        <div className="text-[10px] text-[#666666] uppercase font-mono">Сессий</div>
                        <div className="font-bold text-[#ededed] font-mono mt-0.5">{project.activeSessions} LIVE</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#666666] uppercase font-mono">Хранилище</div>
                        <div className="font-bold text-[#ededed] font-mono mt-0.5">{project.storageUsedMb} MB</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: LIVE SESSIONS ── */}
        {activeTab === "deployments" && (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#ffffff]">Живые Сессии Экзаменов</h3>
                <p className="text-xs text-[#888888] mt-0.5">Мониторинг студентов в режиме реального времени</p>
              </div>
              <span className="text-xs font-mono text-[#50e3c2] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#50e3c2] animate-pulse" />
                <span>{liveSessions.length} Активных подключений</span>
              </span>
            </div>

            <div className="border border-[#222222] rounded-md overflow-hidden font-mono text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#111111] text-[#666666] text-[10px] uppercase border-b border-[#222222]">
                  <tr>
                    <th className="py-2.5 px-4">Сессия / Студент</th>
                    <th className="py-2.5 px-4">Организация</th>
                    <th className="py-2.5 px-4">Тест</th>
                    <th className="py-2.5 px-4 font-right text-right">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {liveSessions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#666666]">
                        Сейчас нет активных экзаменационных сессий.
                      </td>
                    </tr>
                  ) : (
                    liveSessions.map((s) => (
                      <tr key={s.id} className="hover:bg-[#111111]/50">
                        <td className="py-3 px-4 font-bold text-[#ffffff]">{s.shortId || s.studentName || s.id}</td>
                        <td className="py-3 px-4 text-[#888888]">{s.tenantId || 'ОсОО «Академия Будущих Лидеров»'}</td>
                        <td className="py-3 px-4 text-[#888888]">{s.examTitle || 'Вступительное тестирование'}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="bg-[#112211] text-[#50e3c2] border border-[#224422] px-2 py-0.5 rounded text-[10px]">АКТИВНА</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: REQUESTS ── */}
        {activeTab === "requests" && <TenantRequestsTab />}

        {/* ── TAB 3: LOGS ── */}
        {activeTab === "logs" && (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#ffffff]">Системный Аудит и Логи</h3>
                <p className="text-xs text-[#888888] mt-0.5">События из Firestore коллекции /audit_logs</p>
              </div>
            </div>

            <div className="font-mono text-xs space-y-1.5 bg-[#000000] border border-[#222222] p-4 rounded-md max-h-[450px] overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 py-1 border-b border-[#111111] last:border-none">
                  <span className="text-[#555555] text-[11px] whitespace-nowrap">[{log.timestamp}]</span>
                  <span className={`text-[10px] px-1 rounded font-bold ${
                    log.level === "SUCCESS" ? "bg-[#112211] text-[#50e3c2]" : "bg-[#221a00] text-[#f5a623]"
                  }`}>
                    {log.level}
                  </span>
                  <span className="text-[#888888]">{log.route}</span>
                  <span className="text-[#ededed] flex-1">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 4: FEATURE FLAGS ── */}
        {activeTab === "flags" && (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-[#ffffff]">Флаги Прокторинга Организаций</h3>
              <p className="text-xs text-[#888888] mt-0.5">Включение и отключение нейросетевых детекторов прокторинга в реальном времени в Firestore</p>
            </div>

            <div className="space-y-4 font-sans">
              {projects.map((project) => (
                <div key={project.id} className="border border-[#222222] rounded-md p-4 bg-[#111111] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#ffffff]">{project.name}</span>
                    <span className="text-xs font-mono text-[#666666]">slug: {project.slug}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 text-xs">
                    {[
                      { key: "gazeAway", label: "Отведение взгляда" },
                      { key: "faceCount", label: "Детектор лиц" },
                      { key: "handTracking", label: "Трекинг рук" },
                      { key: "audioAnalysis", label: "Анализ звука" },
                      { key: "phoneDetection", label: "Детектор телефонов" },
                    ].map((flag) => {
                      const enabled = (project.proctoringFlags as any)[flag.key];
                      return (
                        <button
                          key={flag.key}
                          onClick={() => toggleFlag(project.id, flag.key as any)}
                          className={`p-2 rounded border font-mono text-[11px] transition text-left cursor-pointer ${
                            enabled 
                              ? "bg-[#112211] border-[#224422] text-[#50e3c2]" 
                              : "bg-[#1a1a1a] border-[#222222] text-[#666666]"
                          }`}
                        >
                          <div className="font-bold">{flag.label}</div>
                          <div className="text-[10px] mt-0.5">{enabled ? "● ВКЛЮЧЕНО" : "○ ОТКЛЮЧЕНО"}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 5: SETTINGS & API KEYS ── */}
        {activeTab === "settings" && (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-[#ffffff]">API Ключи и Настройки</h3>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {projects.map((p) => (
                <div key={p.id} className="bg-[#111111] border border-[#222222] p-4 rounded-md flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#ffffff]">{p.name}</div>
                    <div className="text-[11px] text-[#666666] mt-0.5">ID: {p.id}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="bg-[#000000] border border-[#333333] px-3 py-1.5 rounded text-[#50e3c2]">
                      {p.apiKey}
                    </span>
                    <button
                      onClick={() => copyKey(p.apiKey, p.id)}
                      className="bg-[#222222] hover:bg-[#333333] text-[#ededed] px-3 py-1.5 rounded transition flex items-center gap-1.5 text-xs cursor-pointer"
                    >
                      {copiedKeyId === p.id ? <Check className="w-3.5 h-3.5 text-[#50e3c2]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKeyId === p.id ? "Скопировано" : "Копировать"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
