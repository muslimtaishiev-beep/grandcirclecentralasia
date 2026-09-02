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
  QrCode
} from "lucide-react";
import GlobalNotifications from "../../components/workspace/GlobalNotifications";
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

  const hasPerm = (perm: string) => {
    if (!activeTenant) return false;
    
    // Normalize role string
    const roleLower = String(activeTenant.role || '').toLowerCase();
    const isFullAdmin = [
      'owner', 'org:owner', 'superadmin', 'admin', 'org:admin', 
      'administrator', 'руководитель', 'директор'
    ].some(r => roleLower.includes(r));
    
    if (isFullAdmin) return true;

    // 1. Array or Object permissions (TeamPermissions)
    const p = activeTenant.permissions;
    if (p) {
      if (Array.isArray(p) && p.includes(perm)) return true;
      if (typeof p === 'object' && !Array.isArray(p) && p[perm]) return true;
    }

    // 2. Custom PBAC Matrix permissions (TeamPermissionMatrix)
    const cp = activeTenant.customPermissions;
    if (Array.isArray(cp) && cp.length > 0) {
      const permToModule: Record<string, string[]> = {
        'crm:read': ['mod_crm', 'mod_admissions'],
        'crm:manage': ['mod_crm', 'mod_admissions'],
        'tests:read': ['mod_proctoring'],
        'tests:manage': ['mod_proctoring'],
        'tests:review': ['mod_proctoring'],
        'certificates:issue': ['mod_certificates', 'mod_admissions'],
        'edu:schedule': ['mod_admissions', 'mod_payroll'],
        'edu:payroll': ['mod_payroll'],
        'team:manage': ['mod_settings'],
        'settings:manage': ['mod_settings'],
      };

      const modules = permToModule[perm] || [];
      for (const modId of modules) {
        const modPerm = cp.find((m: any) => m.moduleId === modId);
        if (modPerm && (modPerm.canView || modPerm.canEdit || modPerm.canExecute)) {
          return true;
        }
      }
    }

    return false;
  };

  const navItems = activeTenant ? [
    { name: "Dashboard", path: `/workspace/${activeTenant.id}`, icon: LayoutDashboard },
    hasPerm('edu:schedule') && { name: "Расписание", path: `/workspace/${activeTenant.id}/edu/schedule`, icon: Calendar },
    hasPerm('edu:schedule') && { name: "Журнал", path: `/workspace/${activeTenant.id}/edu/attendance`, icon: UserCheck },
    hasPerm('edu:schedule') && { name: "Абонементы", path: `/workspace/${activeTenant.id}/edu/subscriptions`, icon: CreditCard },
    (hasPerm('edu:payroll') || hasPerm('edu:schedule')) && { name: "Зарплаты", path: `/workspace/${activeTenant.id}/edu/payroll`, icon: DollarSign },
    { name: "Chat", path: `/workspace/${activeTenant.id}/chat`, icon: MessageSquare },
    { name: "Tasks", path: `/workspace/${activeTenant.id}/tasks`, icon: CheckSquare },
    { name: "Проверка билетов", path: `/workspace/${activeTenant.id}/tickets`, icon: QrCode },
    (hasPerm('crm:read') || hasPerm('crm:manage')) && { name: "CRM", path: `/workspace/${activeTenant.id}/crm/contacts`, icon: Briefcase },
    (hasPerm('tests:read') || hasPerm('tests:manage')) && { name: "Тесты", path: `/workspace/${activeTenant.id}/tests`, icon: FileQuestion },
    (hasPerm('tests:review') || hasPerm('tests:manage')) && { name: "Проверка & Прокторинг", path: `/workspace/${activeTenant.id}/tests/manage`, icon: ShieldCheck },
    // Вступительный срез: администрация и роль «завуч». hasPerm already treats
    // owner/admin/директор as full access, so the role check only has to add
    // завуч on top.
    (hasPerm('tests:manage') || hasPerm('tests:review') || /завуч/i.test(String(activeTenant.role || ''))) &&
      { name: "Вступительный срез", path: `/workspace/${activeTenant.id}/placement`, icon: GraduationCap },
    (hasPerm('team:manage') || hasPerm('certificates:issue') || hasPerm('crm:manage')) && { name: "Заявки & QR", path: `/workspace/${activeTenant.id}/builder/forms`, icon: FileCheck2 },
    (hasPerm('team:manage') || hasPerm('settings:manage')) && { name: "Function Studio", path: `/workspace/${activeTenant.id}/functions/studio`, icon: Settings2 },
    (hasPerm('team:manage') || hasPerm('settings:manage')) && { name: "Оргструктура & Отделы", path: `/workspace/${activeTenant.id}/settings/departments`, icon: FolderTree },
    (hasPerm('team:manage') || hasPerm('settings:manage')) && { name: "Матрица Доступов PBAC", path: `/workspace/${activeTenant.id}/settings/permission-matrix`, icon: Sliders },
    (hasPerm('team:manage') || hasPerm('settings:manage')) && { name: "Права & Сотрудники", path: `/workspace/${activeTenant.id}/settings/permissions`, icon: Shield },
    { name: "Docs", path: `/workspace/${activeTenant.id}/docs`, icon: FileText },
    { name: "Sheets", path: `/workspace/${activeTenant.id}/sheets`, icon: FileSpreadsheet },
    (hasPerm('team:manage') || hasPerm('settings:manage')) && { name: "Site Builder", path: `/workspace/${activeTenant.id}/sites`, icon: Globe },
    (activeTenant.role === 'owner' || activeTenant.role === 'org:owner' || activeTenant.role === 'superadmin') && { name: "Тарифы и Биллинг", path: `/workspace/${activeTenant.id}/billing`, icon: CreditCard },
    (hasPerm('team:manage') || hasPerm('settings:manage')) && { name: "Automations", path: `/workspace/${activeTenant.id}/automations`, icon: Zap },
  ].filter(Boolean) as Array<{ name: string, path: string, icon: any }> : [];

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
              {activeTenant?.name && !activeTenant.name.startsWith("org_") ? activeTenant.name : "Grand Circle Central Asia"}
            </span>
          </div>
        </div>

        {/* Center: Search & Global Tabs */}
        <div className="hidden md:flex flex-1 max-w-2xl px-8 items-center gap-6">
          {/* Quick links */}
          <div className="flex gap-4 font-medium text-sm text-[var(--text-main)] overflow-x-auto whitespace-nowrap hide-scrollbar">
            <Link to={`/workspace/${orgId}/chat`} className="hover:text-[var(--accent)] transition">Чаты</Link>
            <Link to={`/workspace/${orgId}/tasks`} className="hover:text-[var(--accent)] transition">Задачи</Link>
            <Link to={`/workspace/${orgId}/crm/deals`} className="hover:text-[var(--accent)] transition">CRM</Link>
            <Link to={`/workspace/${orgId}/tests`} className="hover:text-[var(--accent)] transition">Тесты</Link>
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
               <Outlet context={{ activeTenant: activeTenant || (orgId ? { id: orgId, name: orgId, slug: orgId } : null), tenants }} />
            </main>
          </div>
        </div>
      </div>

    </div>
  );
}
