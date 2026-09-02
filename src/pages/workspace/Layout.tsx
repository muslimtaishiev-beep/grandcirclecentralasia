import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation, useParams, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { 
  Building, 
  Settings, 
  Users, 
  LayoutDashboard,
  LogOut,
  FileText,
  FileSpreadsheet,
  LayoutTemplate,
  Briefcase,
  FileQuestion,
  CheckSquare,
  MessageSquare,
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  Globe,
  Zap,
  Calendar,
  UserCheck,
  CreditCard,
  DollarSign,
  ShieldCheck,
  Shield,
  FolderTree,
  FileCheck2,
  Sliders,
  Settings2,
  GraduationCap,
  QrCode,
  Sparkles
} from "lucide-react";
import GlobalNotifications from "../../components/workspace/GlobalNotifications";
import QuickSetupWizard from "../../components/workspace/QuickSetupWizard";
import { resolvePermissions, navAllowed, type PermissionKey } from "../../shared/permissions";
import SpotlightCommandBar from "../../components/common/SpotlightCommandBar";
import DemoSeedButton from "../../components/common/DemoSeedButton";

export default function WorkspaceLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { orgId } = useParams();

  const [tenants, setTenants] = useState<any[]>([]);
  const [activeTenant, setActiveTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // Мастер настройки закрывается локально после сохранения, не дожидаясь
  // повторной загрузки списка организаций.
  const [setupDone, setSetupDone] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchTenants();
  }, [user]);

  useEffect(() => {
    if (tenants.length > 0) {
      if (orgId) {
        const match = tenants.find(t => t.id === orgId);
        if (match) setActiveTenant(match);
        else navigate(`/workspace/${tenants[0].id}`, { replace: true });
      } else {
        const stored = localStorage.getItem("active_tenant_id");
        const match = tenants.find(t => t.id === stored) || tenants[0];
        navigate(`/workspace/${match.id}`, { replace: true });
      }
    }
  }, [orgId, tenants, navigate]);

  const fetchTenants = async () => {
    try {
      const res = await fetch("/api/tenants/my", {
        headers: {
          "Authorization": `Bearer ${await user?.getIdToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setTenants(data.tenants || []);
      }
    } catch (e) {
      console.error("Failed to load workspaces", e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Права сотрудника. Сервер уже посчитал их в effectivePermissions —
   * здесь только чтение. Локальный расчёт остаётся запасным путём для
   * организаций, которые ещё не перезагрузили список после обновления.
   *
   * Прежняя проверка искала подстроки «admin»/«руководитель»/«директор» в
   * названии роли: созданная владельцем должность «Директор по продажам»
   * молча получала доступ ко всему, включая зарплаты.
   */
  const granted = React.useMemo(() => {
    if (!activeTenant) return new Set<PermissionKey>();
    if (Array.isArray(activeTenant.effectivePermissions)) {
      return new Set(activeTenant.effectivePermissions as PermissionKey[]);
    }
    return resolvePermissions({
      role: activeTenant.role,
      permissions: activeTenant.permissions,
      customPermissions: activeTenant.customPermissions,
      rolePermissions: activeTenant.customRole?.permissions,
      disabledModules: activeTenant.disabledModules,
    });
  }, [activeTenant]);

  const canSee = (navKey: string) => navAllowed(navKey, granted);
  const hasPerm = (perm: string) => granted.has(perm as PermissionKey);

  // Пункты меню и права на них — из общей карты NAV_PERMISSION, а не
  // россыпью условий: одно место, где видно, что чем закрыто.
  const navItems = activeTenant ? ([
    ["dashboard", "Dashboard", "", LayoutDashboard],
    ["schedule", "Расписание", "/edu/schedule", Calendar],
    ["attendance", "Журнал", "/edu/attendance", UserCheck],
    ["subscriptions", "Абонементы", "/edu/subscriptions", CreditCard],
    ["payroll", "Зарплаты", "/edu/payroll", DollarSign],
    ["chat", "Chat", "/chat", MessageSquare],
    ["tasks", "Tasks", "/tasks", CheckSquare],
    ["tickets", "Проверка билетов", "/tickets", QrCode],
    ["crm", "CRM", "/crm/contacts", Briefcase],
    ["tests", "Тесты", "/tests", FileQuestion],
    ["testsManage", "Проверка & Прокторинг", "/tests/manage", ShieldCheck],
    ["placement", "Вступительный срез", "/placement", GraduationCap],
    ["forms", "Заявки & QR", "/builder/forms", FileCheck2],
    ["functions", "Function Studio", "/functions/studio", Settings2],
    ["departments", "Оргструктура & Отделы", "/settings/departments", FolderTree],
    ["permissions", "Роли & Доступы", "/settings/roles", Shield],
    ["permissions", "Права & Сотрудники", "/settings/permissions", Users],
    ["workspaceSetup", "Настройка воркспейса", "/settings/workspace", Sparkles],
    ["docs", "Docs", "/docs", FileText],
    ["sheets", "Sheets", "/sheets", FileSpreadsheet],
    ["sites", "Site Builder", "/sites", Globe],
    ["automations", "Automations", "/automations", Zap],
  ] as const)
    .filter(([key]) => {
      // Вступительный срез открыт ещё и роли «завуч» — школьная роль без
      // общих прав на тесты.
      if (key === "placement" && /завуч/i.test(String(activeTenant.role || ""))) return true;
      return canSee(key);
    })
    .map(([, name, suffix, icon]) => ({
      name: name as string, path: `/workspace/${activeTenant.id}${suffix}`, icon: icon as any,
    }))
    .concat(
      // Биллинг — только владельцу организации, правами не выдаётся.
      ["owner", "org:owner", "superadmin"].includes(String(activeTenant.role))
        ? [{ name: "Тарифы и Биллинг", path: `/workspace/${activeTenant.id}/billing`, icon: CreditCard }]
        : []
    ) : [];

  if (loading) {
    return <div className="min-h-dvh bg-[var(--bg-app)] flex items-center justify-center text-[var(--text-muted)] font-mono text-sm">Loading Workspace...</div>;
  }

  return (
    <div 
      className="h-dvh w-full flex flex-col overflow-hidden transition-colors duration-300 relative"
      style={{ background: activeTenant?.brandColor || (theme === 'light' ? '#e0f2fe' : '#0f172a') }}
    >
      {/* Background Decor (optional glassmorphism base) */}
      <div className="absolute inset-0 bg-white/30 dark:bg-black/30 backdrop-blur-[2px] z-0 pointer-events-none"></div>

      {/* Top Navigation Bar */}
      <div className="h-14 w-full flex items-center justify-between px-4 z-10 bg-[var(--bg-panel)] backdrop-blur-md border-b border-[var(--border-color)]">
        
        {/* Left: Logo & Menu Toggle */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-[var(--text-main)] transition cursor-pointer"
            title="Toggle Sidebar Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[var(--accent)] flex items-center justify-center">
              <Building className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[var(--text-main)] hidden sm:block">
              {activeTenant?.name && !activeTenant.name.startsWith("org_") ? activeTenant.name : "Воркспейс"}
            </span>
          </div>
        </div>

        {/* Center: Search & Global Tabs */}
        <div className="hidden md:flex flex-1 max-w-2xl px-8 items-center gap-6">
          {/* Quick links */}
          <div className="flex gap-4 font-medium text-sm text-[var(--text-main)] overflow-x-auto whitespace-nowrap hide-scrollbar">
            {/* Быстрые ссылки в шапке подчиняются тем же правам, что и меню
                слева: иначе сотрудник видел бы «CRM» в двух местах, где одно
                ведёт на экран «нет доступа». */}
            {canSee('chat') && <Link to={`/workspace/${orgId}/chat`} className="hover:text-[var(--accent)] transition">Чаты</Link>}
            {canSee('tasks') && <Link to={`/workspace/${orgId}/tasks`} className="hover:text-[var(--accent)] transition">Задачи</Link>}
            {canSee('crm') && <Link to={`/workspace/${orgId}/crm/deals`} className="hover:text-[var(--accent)] transition">CRM</Link>}
            {canSee('tests') && <Link to={`/workspace/${orgId}/tests`} className="hover:text-[var(--accent)] transition">Тесты</Link>}
          </div>

          <div className="flex-1 relative cursor-pointer" onClick={() => setIsSearchOpen(true)}>
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Search people, documents, tasks (Cmd+K)..."
              readOnly
              className="w-full bg-black/5 dark:bg-white/5 border border-[var(--border-color)] rounded-full pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] text-[var(--text-main)] cursor-pointer"
            />
          </div>
        </div>

        <SpotlightCommandBar isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

        {/* Right: User Profile & Tools */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSearchOpen(true)} 
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-[var(--text-main)] transition cursor-pointer"
            title="Поиск (Cmd+K)"
          >
            <Search className="w-4 h-4" />
          </button>
          <DemoSeedButton />
          <button onClick={toggleTheme} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-[var(--text-main)] transition">
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <GlobalNotifications />
          
          {/* Profile Button / Link to Settings */}
          <button 
            onClick={() => navigate(`/workspace/${orgId}/settings/permissions`)}
            className="flex items-center gap-2 pl-2 border-l border-[var(--border-color)] cursor-pointer hover:opacity-80 transition"
            title="Settings Profile"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center font-bold text-white text-xs">
              {user?.email?.[0]?.toUpperCase() || "M"}
            </div>
          </button>
        </div>
      </div>

      {/* Быстрая настройка: только новые организации (флаг ставится при
          одобрении заявки) и только владельцу/админу — сотрудник не должен
          решать за компанию, как называются её экраны. */}
      {activeTenant?.needsWorkspaceSetup && !setupDone &&
        (granted.has("settings:manage") || granted.has("team:manage")) && (
        <QuickSetupWizard tenant={activeTenant}
          onDone={() => { setSetupDone(true); fetchTenants(); }} />
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden z-10">
        
        {/* Thin Left Sidebar (Icons Only) */}
        <div className="w-16 bg-[var(--bg-panel)] backdrop-blur-md border-r border-[var(--border-color)] flex flex-col items-center py-4 gap-2">
          {navItems.map((item) => {
            const isActive = location.pathname.includes(item.path);
            return (
              <Link 
                key={item.name}
                to={item.path}
                title={item.name}
                data-tooltip={item.name}
                data-tooltip-pos="right"
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all group relative ${
                  isActive 
                    ? 'bg-[var(--accent)] text-white shadow-md' 
                    : 'text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--text-main)]'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'scale-110' : 'group-hover:scale-110 transition-transform'}`} />
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>
                )}
              </Link>
            )
          })}

          <div className="mt-auto">
            <button 
              onClick={logout}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Outlet (The actual page content) */}
        <div className="flex-1 overflow-hidden p-2 sm:p-4 md:p-6">
          <div className="w-full h-full bg-[var(--bg-surface)]/80 backdrop-blur-xl border border-[var(--border-color)] rounded-2xl shadow-xl overflow-y-auto">
            {/* Some pages (like Chat) have their own strict layouts, others have normal padding. 
                For Chat specifically, we might want to override padding, but let's keep it clean for now. */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[var(--bg-app)]">
               <Outlet context={{ activeTenant: activeTenant || (orgId ? { id: orgId, name: orgId, slug: orgId } : null), tenants, refreshTenants: fetchTenants }} />
            </main>
          </div>
        </div>
      </div>

    </div>
  );
}
