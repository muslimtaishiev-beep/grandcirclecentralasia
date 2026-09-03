import React, { useState, useEffect, Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { Globe, Phone, Loader2 } from "lucide-react";

// Components — lazy-loaded to reduce initial bundle
const Header = lazy(() => import("./components/Header"));
const Hero = lazy(() => import("./components/Hero"));
const GlobeSplitSection = lazy(() => import("./components/GlobeSplitSection").then(m => ({ default: m.GlobeSplitSection })));
const SchedulePanel = lazy(() => import("./components/SchedulePanel"));
const TicketsPanel = lazy(() => import("./components/TicketsPanel"));
const PartnersPanel = lazy(() => import("./components/PartnersPanel"));
const Newsletter = lazy(() => import("./components/Newsletter"));
const FAQSection = lazy(() => import("./components/FAQSection"));
const AdminCMS = lazy(() => import("./components/AdminCMS"));
const SubscriptionBillingDashboard = React.lazy(() => import('./pages/workspace/billing/SubscriptionBillingDashboard'));
const GlobalWatermarks = lazy(() => import("./components/GlobalWatermarks"));
const MetricsCarousel = lazy(() => import("./components/MetricsCarousel").then(m => ({ default: m.MetricsCarousel })));
import { Routes, Route, useLocation, useNavigate, Link, Navigate } from "react-router-dom";

// New Pages
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Decision = lazy(() => import("./pages/Decision"));
const Landing = lazy(() => import("./pages/Landing"));
const Testing = lazy(() => import("./pages/Testing"));
const PlacementExam = lazy(() => import("./pages/PlacementExam"));
const PlacementCabinet = lazy(() => import("./pages/PlacementCabinet"));
const PlacementResultPortal = lazy(() => import("./pages/PlacementResultPortal"));
const ManagerForm = lazy(() => import("./pages/ManagerForm"));
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard"));
const Receipt = lazy(() => import("./pages/Receipt"));
const PsychologistForm = lazy(() => import("./pages/PsychologistForm"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const ProctorSandbox = lazy(() => import("./pages/ProctorSandbox"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const MaintenanceMode = lazy(() => import("./pages/MaintenanceMode"));

// Workspace Modules
const WorkspaceLayout = lazy(() => import("./pages/workspace/Layout"));
const WorkspaceDashboard = lazy(() => import("./pages/workspace/Dashboard"));
const WorkspaceSettings = lazy(() => import("./pages/workspace/Settings"));
const OrgStructure = lazy(() => import("./pages/workspace/settings/OrgStructure"));
const DocumentTemplates = lazy(() => import("./pages/workspace/settings/DocumentTemplates"));
const WorkspaceBuilder = lazy(() => import("./pages/workspace/Builder"));
const FormBuilder = lazy(() => import("./pages/workspace/builder/FormBuilder"));
const TicketScanner = lazy(() => import("./pages/workspace/tickets/TicketScanner"));
const WorkspaceSetupPage = lazy(() => import("./pages/workspace/settings/WorkspaceSetupPage"));
import RequirePermission from "./components/workspace/RequirePermission";
const RolesAndAccess = lazy(() => import("./pages/workspace/settings/RolesAndAccess"));
const FunctionStudio = lazy(() => import("./pages/workspace/functions/FunctionStudio"));
const QrTracker = lazy(() => import("./pages/public/QrTracker"));
const PublicForm = lazy(() => import("./pages/public/PublicForm"));
const DocumentsListPage = lazy(() => import("./pages/workspace/docs/DocumentsListPage"));
const DocumentEditorPage = lazy(() => import("./pages/workspace/docs/DocumentEditorPage"));
const SheetsListPage = lazy(() => import("./pages/workspace/sheets/SheetsListPage"));
const SheetSpreadsheetPage = lazy(() => import("./pages/workspace/sheets/SheetSpreadsheetPage"));
const CrmContacts = lazy(() => import("./pages/workspace/crm/ContactsDirectoryPage"));
const CrmDeals = lazy(() => import("./pages/workspace/crm/DealsKanbanPage"));
const TestList = lazy(() => import("./pages/workspace/tests/TestList"));
const TestEditor = lazy(() => import("./pages/workspace/tests/TestEditor"));
const TaskBoard = lazy(() => import("./pages/workspace/tasks/TasksBoardPage"));
const TaskList = lazy(() => import("./pages/workspace/tasks/TasksListPage"));
const ChatLayout = lazy(() => import("./pages/workspace/chat/ChatLayout"));
const SiteBuilder = lazy(() => import("./pages/workspace/site/SiteBuilder"));
const PublicSiteRenderer = lazy(() => import("./pages/public/PublicSiteRenderer"));
const PublicPageEngine = lazy(() => import("./pages/public/PublicPageEngine"));
const AutomationsDirectoryPage = lazy(() => import("./pages/workspace/automations/AutomationsDirectoryPage"));
const AutomationLogsPage = lazy(() => import("./pages/workspace/automations/AutomationLogsPage"));
const ScheduleGrid = lazy(() => import("./pages/workspace/edu/ScheduleCalendarPage"));
const AttendanceJournal = lazy(() => import("./pages/workspace/edu/AttendanceJournalPage"));
const SubscriptionsManager = lazy(() => import("./pages/workspace/edu/SubscriptionsDirectoryPage"));
const TeacherPayroll = lazy(() => import("./pages/workspace/edu/TeacherPayrollPage"));

import { ProtectedRoute } from "./components/ProtectedRoute";
import { GracefulErrorBoundary } from "./components/ui/GracefulErrorBoundary";
import ExamErrorBoundary from "./components/ExamErrorBoundary";
import { TenantProvider } from './context/TenantContext';
import DashboardSkeleton from "./components/skeletons/DashboardSkeleton";
import CrmSkeleton from "./components/skeletons/CrmSkeleton";
import TaskSkeleton from "./components/skeletons/TaskSkeleton";
import ChatSkeleton from "./components/skeletons/ChatSkeleton";
import DocsSkeleton from "./components/skeletons/DocsSkeleton";
import SheetsSkeleton from "./components/skeletons/SheetsSkeleton";
import CookieBanner from "./components/ui/CookieBanner";
import { SkipToContent } from "./components/ui/SkipToContent";
import { captureUtmParameters } from "./lib/utmTracker";

import { PublicData } from "./types";
import { staticDb } from "./data/staticDb";


import { GlobalTooltip } from "./components/ui/GlobalTooltip";

export default function App() {
  const [lang, setLang] = useState<"ru" | "en" | "kg">("ru");

  useEffect(() => {
    captureUtmParameters();
  }, []);
  
  // Basic routing via react-router
  const location = useLocation();
  const navigateRouter = useNavigate();
  const currentPath = location.pathname;
  const [loading, setLoading] = useState(true);
  const [dataTrigger, setDataTrigger] = useState(0);
  const [showAllSpeakers, setShowAllSpeakers] = useState(false);

  // Maintenance state
  const [maintenanceInfo, setMaintenanceInfo] = useState<{ enabled: boolean; message?: string; estimatedTime?: string }>({ enabled: false });

  const navigate = (path: string) => {
    navigateRouter(path);
    window.scrollTo(0, 0);
  };

  const [publicData, setPublicData] = useState<PublicData | null>(null);

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const response = await fetch((import.meta.env.VITE_API_URL || "") + "/api/public/data");
        if (response.ok) {
          const resJson = await response.json();
          setPublicData(resJson);
        }
      } catch (err) {
        console.error("Failed to load global server resources.", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchMaintenance = async () => {
      try {
        const res = await fetch((import.meta.env.VITE_API_URL || "") + "/api/public/maintenance");
        if (res.ok) {
          const data = await res.json();
          if (data) setMaintenanceInfo(data);
        }
      } catch (e) {}
    };

    fetchPublicData();
    fetchMaintenance();
  }, [dataTrigger]);

  const forceRefetch = () => {
    setDataTrigger(prev => prev + 1);
  };

  // The app will now render immediately using staticDb while the backend wakes up in the background.

  const data = {
    settings: publicData?.settings || staticDb.settings,
    speakers: publicData?.speakers || staticDb.speakers,
    program: publicData?.program || staticDb.program,
    partners: publicData?.partners || staticDb.partners,
    tickets: publicData?.tickets || staticDb.tickets,
    metrics: publicData?.metrics && publicData.metrics.length > 0 ? publicData.metrics : staticDb.metrics,
    universities: publicData?.universities && publicData.universities.length > 0 ? publicData.universities : []
  } as unknown as PublicData;

  const isAdminPath = currentPath === "/admin";
  const isSuperAdminPath = currentPath.startsWith("/super-admin");
  const isTicketsPath = currentPath === "/tickets";

  // Maintenance Mode Dynamic Control (except for /super-admin)
  const isMaintenanceActive = Boolean(maintenanceInfo.enabled) && !isSuperAdminPath;
  if (isMaintenanceActive) {
    return (
    <TenantProvider>
    <div className="min-h-dvh flex flex-col bg-slate-50 font-sans selection:bg-[#9F7AEA] selection:text-white relative">
      <SkipToContent targetId="main-content" />
      <CookieBanner />
      <Suspense fallback={<div className="min-h-dvh bg-[#050508] text-white flex items-center justify-center">Loading...</div>}>
        <MaintenanceMode 
          message={maintenanceInfo.message}
          estimatedTime={maintenanceInfo.estimatedTime}
          onRefreshCheck={forceRefetch}
        />
      </Suspense>
    </div>
    </TenantProvider>
    );
  }

  return (
    <TenantProvider>
    <div className="min-h-dvh bg-[#EDE9FE] text-slate-800 antialiased font-sans flex flex-col justify-between" id="main_app_wrapper">
      <SkipToContent targetId="main-content" />
      <CookieBanner />
      <GlobalTooltip />
      
      {/* Header is global */}
      {!isAdminPath && !currentPath.startsWith("/super-admin") && !currentPath.startsWith("/workspace") && !currentPath.match(/^\/[^\/]+\/(admission|test|placement|results)/) && !currentPath.startsWith("/login") && !currentPath.startsWith("/register") && !currentPath.startsWith("/dashboard") && !currentPath.startsWith("/decision") && !currentPath.startsWith("/sandbox") && !currentPath.startsWith("/form/") && !currentPath.startsWith("/track/") && (
        <Header 
          lang={lang} 
          setLang={setLang} 
          onNavigate={navigate}
        />
      )}

      {/* Floating Language Switcher for Admission Portal Pages */}
      {(!isAdminPath && (currentPath.match(/^\/[^\/]+\/(admission|test|placement|results)/) || currentPath.startsWith("/login") || currentPath.startsWith("/register") || currentPath.startsWith("/dashboard") || currentPath.startsWith("/decision"))) && (
        <div className="absolute top-4 right-4 md:top-8 md:right-8 z-50">
          <button 
            onClick={() => setLang(lang === "ru" ? "en" : lang === "en" ? "kg" : "ru")}
            className="px-4 py-2 bg-slate-900/50 backdrop-blur-md border border-white/20 text-white font-mono text-sm uppercase tracking-widest hover:bg-slate-800/80 transition-colors rounded-full shadow-lg flex items-center gap-2"
          >
            <Globe className="w-4 h-4" />
            {lang === "ru" ? "RU" : lang === "en" ? "EN" : "KG"}
          </button>
        </div>
      )}

      <main className="flex-grow">
        <Suspense fallback={<div className="min-h-dvh flex flex-col items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-slate-400 mb-4" /><div className="text-slate-500 text-sm font-medium uppercase tracking-widest">Loading...</div></div>}>
        <Routes>
          <Route path="/admin" element={
            <div className="bg-[#EDE9FE] min-h-[75vh]">
              <AdminCMS lang={lang} onDataChange={forceRefetch} />
            </div>
          } />
          
          <Route path="/tickets" element={
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="pt-20 pb-32"
            >
              <TicketsPanel tickets={data.tickets} lang={lang} />
            </motion.div>
          } />

          {/* Admission Portal Routes */}
          <Route path="/:orgSlug/admission" element={<Landing lang={lang} />} />
          {/* The exam routes had no error boundary at all: a render crash
              unmounted the tree and left the student on a blank grey page
              mid-exam, with no way back. */}
          {/* Вступительный срез — тенантный маршрут, как и остальные экзамены. */}
          <Route path="/:orgSlug/placement" element={<ExamErrorBoundary><PlacementExam /></ExamErrorBoundary>} />
          {/* Портал результатов — ученики ищут себя по номеру работы и фамилии. */}
          <Route path="/:orgSlug/results" element={<ExamErrorBoundary><PlacementResultPortal /></ExamErrorBoundary>} />
          <Route path="/:orgSlug/test" element={<ExamErrorBoundary><Testing /></ExamErrorBoundary>} />
          <Route path="/:orgSlug/test/:testId" element={<ExamErrorBoundary><Testing /></ExamErrorBoundary>} />
          <Route path="/login" element={<Login lang={lang} />} />
          <Route path="/register" element={<Signup lang={lang} />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard lang={lang} />
            </ProtectedRoute>
          } />
          <Route path="/decision" element={
            <ProtectedRoute>
              <Decision lang={lang} />
            </ProtectedRoute>
          } />
          

          <Route path="/manager/form" element={<Navigate to="/workspace" replace />} />
          <Route path="/manager-dashboard" element={<Navigate to="/workspace" replace />} />
          <Route path="/receipt/:shortId" element={<Receipt />} />
          <Route path="/psychologist/:shortId" element={<ProtectedRoute><PsychologistForm /></ProtectedRoute>} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfUse />} />

          <Route path="/sandbox/proctor" element={<ProtectedRoute><ProctorSandbox /></ProtectedRoute>} />
          <Route path="/super-admin" element={<GracefulErrorBoundary fallbackTitle="Ошибка Superadmin"><SuperAdminDashboard /></GracefulErrorBoundary>} />
          <Route path="/superadmin" element={<GracefulErrorBoundary fallbackTitle="Ошибка Superadmin"><SuperAdminDashboard /></GracefulErrorBoundary>} />
          <Route path="/sites/:orgId/:slug" element={<GracefulErrorBoundary fallbackTitle="Ошибка Сайта"><PublicSiteRenderer /></GracefulErrorBoundary>} />
          <Route path="/site/:subdomain/:slug" element={<GracefulErrorBoundary fallbackTitle="Ошибка Сайта"><PublicPageEngine /></GracefulErrorBoundary>} />
          <Route path="/p/:slug" element={<GracefulErrorBoundary fallbackTitle="Ошибка Сайта"><PublicPageEngine /></GracefulErrorBoundary>} />
          <Route path="/track/:qrToken" element={<GracefulErrorBoundary fallbackTitle="Ошибка QR-Трекера"><QrTracker /></GracefulErrorBoundary>} />
          <Route path="/form/:formId" element={<GracefulErrorBoundary fallbackTitle="Ошибка Формы Заявки"><PublicForm /></GracefulErrorBoundary>} />
          
          <Route path="/workspace" element={<ProtectedRoute><WorkspaceLayout /></ProtectedRoute>}>
            <Route index element={<GracefulErrorBoundary fallbackTitle="Ошибка Дашборда"><Suspense fallback={<DashboardSkeleton />}><WorkspaceDashboard /></Suspense></GracefulErrorBoundary>} />
            <Route path=":orgId" element={<GracefulErrorBoundary fallbackTitle="Ошибка Дашборда"><Suspense fallback={<DashboardSkeleton />}><WorkspaceDashboard /></Suspense></GracefulErrorBoundary>} />
            <Route path=":orgId/dashboard" element={<GracefulErrorBoundary fallbackTitle="Ошибка Дашборда"><Suspense fallback={<DashboardSkeleton />}><WorkspaceDashboard /></Suspense></GracefulErrorBoundary>} />
            <Route path=":orgId/settings" element={<GracefulErrorBoundary fallbackTitle="Ошибка Настроек"><WorkspaceSettings /></GracefulErrorBoundary>} />
            {/* Роли и права сведены в один экран /settings/roles. Старые
                адреса (в закладках, в письмах-инвайтах) редиректим туда, чтобы
                не появлялось два рассинхронизированных экрана про одно и то же. */}
            <Route path=":orgId/settings/permissions" element={<Navigate to="../roles" relative="path" replace />} />
            <Route path=":orgId/settings/permission-matrix" element={<Navigate to="../roles" relative="path" replace />} />
            <Route path=":orgId/settings/roles" element={<GracefulErrorBoundary fallbackTitle="Ошибка Ролей"><RequirePermission navKey="permissions"><RolesAndAccess /></RequirePermission></GracefulErrorBoundary>} />
            <Route path=":orgId/settings/workspace" element={<RequirePermission navKey="workspaceSetup"><GracefulErrorBoundary fallbackTitle="Ошибка Настроек Воркспейса"><WorkspaceSetupPage /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/settings/departments" element={<RequirePermission navKey="departments"><GracefulErrorBoundary fallbackTitle="Ошибка Оргструктуры"><OrgStructure /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/settings/templates" element={<GracefulErrorBoundary fallbackTitle="Ошибка Шаблонов"><DocumentTemplates /></GracefulErrorBoundary>} />
            <Route path=":orgId/builder" element={<GracefulErrorBoundary fallbackTitle="Ошибка Конструктора"><WorkspaceBuilder /></GracefulErrorBoundary>} />
            <Route path=":orgId/builder/forms" element={<RequirePermission navKey="forms"><GracefulErrorBoundary fallbackTitle="Ошибка Конструктора Заявок"><FormBuilder /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/tickets" element={<RequirePermission navKey="tickets"><GracefulErrorBoundary fallbackTitle="Ошибка Сканера Билетов"><TicketScanner /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/functions/studio" element={<RequirePermission navKey="functions"><GracefulErrorBoundary fallbackTitle="Ошибка Визуального Конструктора"><FunctionStudio /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/sites" element={<RequirePermission navKey="sites"><GracefulErrorBoundary fallbackTitle="Ошибка Конструктора Сайтов"><SiteBuilder /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/billing" element={<GracefulErrorBoundary fallbackTitle="Ошибка Биллинга"><SubscriptionBillingDashboard /></GracefulErrorBoundary>} />
            <Route path=":orgId/automations" element={<RequirePermission navKey="automations"><GracefulErrorBoundary fallbackTitle="Ошибка Автоматизаций"><AutomationsDirectoryPage /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/automations/logs" element={<GracefulErrorBoundary fallbackTitle="Ошибка Журнала Автоматизаций"><AutomationLogsPage /></GracefulErrorBoundary>} />
            <Route path=":orgId/docs" element={<RequirePermission navKey="docs"><GracefulErrorBoundary fallbackTitle="Ошибка Документов"><Suspense fallback={<DocsSkeleton />}><DocumentsListPage /></Suspense></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/docs/new" element={<GracefulErrorBoundary fallbackTitle="Ошибка Редактора Документов"><Suspense fallback={<DocsSkeleton />}><DocumentEditorPage /></Suspense></GracefulErrorBoundary>} />
            <Route path=":orgId/docs/:id" element={<GracefulErrorBoundary fallbackTitle="Ошибка Редактора Документов"><Suspense fallback={<DocsSkeleton />}><DocumentEditorPage /></Suspense></GracefulErrorBoundary>} />
            <Route path=":orgId/sheets" element={<RequirePermission navKey="sheets"><GracefulErrorBoundary fallbackTitle="Ошибка Таблиц"><Suspense fallback={<SheetsSkeleton />}><SheetsListPage /></Suspense></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/sheets/new" element={<GracefulErrorBoundary fallbackTitle="Ошибка Редактора Таблиц"><Suspense fallback={<SheetsSkeleton />}><SheetSpreadsheetPage /></Suspense></GracefulErrorBoundary>} />
            <Route path=":orgId/sheets/:sheetId" element={<GracefulErrorBoundary fallbackTitle="Ошибка Редактора Таблиц"><Suspense fallback={<SheetsSkeleton />}><SheetSpreadsheetPage /></Suspense></GracefulErrorBoundary>} />
            <Route path=":orgId/crm/contacts" element={<RequirePermission navKey="crm"><GracefulErrorBoundary fallbackTitle="Ошибка CRM Контактов"><Suspense fallback={<CrmSkeleton />}><CrmContacts /></Suspense></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/crm/deals" element={<RequirePermission navKey="crm"><GracefulErrorBoundary fallbackTitle="Ошибка CRM Сделок"><Suspense fallback={<CrmSkeleton />}><CrmDeals /></Suspense></GracefulErrorBoundary></RequirePermission>} />
            
            {/* Multi-Tenant Testing & Evaluation Routes */}
            <Route path=":orgId/tests" element={<RequirePermission navKey="tests"><GracefulErrorBoundary fallbackTitle="Ошибка Тестов"><TestList /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/tests/new" element={<RequirePermission navKey="tests"><GracefulErrorBoundary fallbackTitle="Ошибка Редактора Тестов"><TestEditor /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/placement" element={<RequirePermission navKey="placement"><GracefulErrorBoundary fallbackTitle="Ошибка Кабинета Завуча"><PlacementCabinet /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/tests/manage" element={<RequirePermission navKey="testsManage"><GracefulErrorBoundary fallbackTitle="Ошибка Проверки Менеджера"><ManagerDashboard /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/tests/check" element={<RequirePermission navKey="testsManage"><GracefulErrorBoundary fallbackTitle="Ошибка Формы Оценки"><ManagerForm /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/tests/check/:shortId" element={<GracefulErrorBoundary fallbackTitle="Ошибка Формы Оценки"><ManagerForm /></GracefulErrorBoundary>} />
            <Route path=":orgId/tests/psychology/:shortId" element={<GracefulErrorBoundary fallbackTitle="Ошибка Формы Психолога"><PsychologistForm /></GracefulErrorBoundary>} />
            <Route path=":orgId/tests/:id" element={<GracefulErrorBoundary fallbackTitle="Ошибка Редактора Тестов"><TestEditor /></GracefulErrorBoundary>} />
            <Route path=":orgId/take-test/:testId" element={<GracefulErrorBoundary fallbackTitle="Ошибка Прохождения Теста"><Testing /></GracefulErrorBoundary>} />

            <Route path=":orgId/tasks" element={<GracefulErrorBoundary fallbackTitle="Ошибка Задач"><Suspense fallback={<TaskSkeleton />}><TaskList /></Suspense></GracefulErrorBoundary>} />
            <Route path=":orgId/tasks/list" element={<GracefulErrorBoundary fallbackTitle="Ошибка Задач"><Suspense fallback={<TaskSkeleton />}><TaskList /></Suspense></GracefulErrorBoundary>} />
            <Route path=":orgId/tasks/board" element={<GracefulErrorBoundary fallbackTitle="Ошибка Канбана Задач"><Suspense fallback={<TaskSkeleton />}><TaskBoard /></Suspense></GracefulErrorBoundary>} />
            <Route path=":orgId/chat" element={<GracefulErrorBoundary fallbackTitle="Ошибка Чата"><Suspense fallback={<ChatSkeleton />}><ChatLayout /></Suspense></GracefulErrorBoundary>} />

            {/* Educational Core Engine (Phase 2) */}
            <Route path=":orgId/edu/schedule" element={<RequirePermission navKey="schedule"><GracefulErrorBoundary fallbackTitle="Ошибка Расписания"><ScheduleGrid /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/edu/attendance" element={<RequirePermission navKey="attendance"><GracefulErrorBoundary fallbackTitle="Ошибка Журнала"><AttendanceJournal /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/edu/subscriptions" element={<RequirePermission navKey="subscriptions"><GracefulErrorBoundary fallbackTitle="Ошибка Абонементов"><SubscriptionsManager /></GracefulErrorBoundary></RequirePermission>} />
            <Route path=":orgId/edu/payroll" element={<RequirePermission navKey="payroll"><GracefulErrorBoundary fallbackTitle="Ошибка Зарплат"><TeacherPayroll /></GracefulErrorBoundary></RequirePermission>} />
          </Route>

          {/* Main Forum Route */}
          <Route path="/" element={
            <div className="space-y-0 pb-10 relative">
              <GlobalWatermarks />
              
              <Hero lang={lang} settings={data.settings} onNavigate={navigate} />

              {/* KEY METRICS BENTO GRID */}
              <motion.section 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-20"
              >
                <MetricsCarousel lang={lang} metrics={data.metrics} />
              </motion.section>

              {/* GLOBE & SPEAKERS SECTION */}
              <GlobeSplitSection speakers={data.speakers} universities={data.universities} />
   
              {/* TIMELINE SECTION */}
              <motion.section 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" id="schedule"
              >
                <SchedulePanel program={data.program} speakers={data.speakers} universities={data.universities} lang={lang} />
              </motion.section>
   
              {/* PARTNERS SECTION */}
              <motion.section 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="py-8 md:py-10 border-y border-[#E9D5FF]/50" id="partners"
              >
                <PartnersPanel partners={data.partners} lang={lang} />
              </motion.section>

              {/* NEWSLETTER */}
              <motion.section 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="py-12 md:py-16"
              >
                <Newsletter lang={lang} />
              </motion.section>

              {/* FAQ */}
              <FAQSection lang={lang} />
            </div>
          } />
        </Routes>
        </Suspense>
      </main>
 
      {/* Footer Branding Area (Hidden on Workspace App) */}
      {!currentPath.startsWith('/workspace') && (
        <footer className="border-t border-[#E9D5FF]/80 py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            
            <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 pb-8 gap-4">
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                <span className="block text-xl font-bold text-slate-900 tracking-tight">
                  LEAD+ <span className="text-[#9F7AEA]">Forum</span>
                </span>
                <span className="block text-sm text-slate-500 mt-1">
                  Кыргызстан, Бишкек, Технопарк
                </span>
              </div>
   
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600 font-medium">
                <a href={`tel:${data.settings.contactPhone}`} className="hover:text-[#9F7AEA] flex items-center space-x-2 transition">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{data.settings.contactPhone}</span>
                </a>
                <span className="hidden sm:inline text-slate-300">|</span>
                <a href="https://www.instagram.com/youthleadnetwork?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" target="_blank" rel="noopener noreferrer" className="hover:text-[#9F7AEA] font-bold">
                  Instagram
                </a>
              </div>
            </div>
   
            <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 mt-8 gap-4">
              <p>
                © {new Date().getFullYear()} {lang === "ru" ? "Главное Образовательное Событие Года." : lang === "kg" ? "Жылдын башкы билим берүү окуясы." : "The Main Educational Event of the Year."} All Rights Reserved.
              </p>
              <div className="flex gap-4">
                <Link to="/privacy" className="hover:text-[#9F7AEA] hover:underline transition">
                  {lang === "ru" ? "Политика конфиденциальности" : lang === "kg" ? "Купуялык саясаты" : "Privacy Policy"}
                </Link>
                <Link to="/terms" className="hover:text-[#9F7AEA] hover:underline transition">
                  {lang === "ru" ? "Пользовательское соглашение" : lang === "kg" ? "Колдонуучу келишими" : "Terms of Use"}
                </Link>
              </div>
            </div>
   
          </div>
        </footer>
      )}
    </div>
    </TenantProvider>
  );
}
