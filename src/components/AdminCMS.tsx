import React, { useState, useEffect } from "react";
import { 
  Lock, Loader2, Download, Plus, Trash2, Edit2, Check, X, 
  Settings as SettingsIcon, Users, Calendar, Award, DollarSign, ShieldAlert, LogOut,
  Landmark
} from "lucide-react";
import { Speaker, ProgramSlot, Partner, Ticket, Settings, Subscriber, Metric } from "../types";

interface AdminCMSProps {
  lang: "ru" | "en";
  onDataChange: () => void; // Trigger a refresh on the parent public frame
}

type AdminTab = "metrics" | "subscribers" | "speakers" | "program" | "tickets" | "partners" | "settings";

export default function AdminCMS({ lang, onDataChange }: AdminCMSProps) {
  const [token, setToken] = useState<string>(localStorage.getItem("admin_token") || "");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  // Active Admin States
  const [currentTab, setCurrentTab] = useState<AdminTab>("metrics");
  const [dbData, setDbData] = useState<{
    settings: Settings;
    speakers: Speaker[];
    program: ProgramSlot[];
    partners: Partner[];
    tickets: Ticket[];
    subscribers: Subscriber[];
    metrics: Metric[];
  } | null>(null);

  // Editing Actions / Modal controls
  const [editingMetric, setEditingMetric] = useState<Partial<Metric> | null>(null);
  const [editingSpeaker, setEditingSpeaker] = useState<Partial<Speaker> | null>(null);
  const [editingSlot, setEditingSlot] = useState<Partial<ProgramSlot> | null>(null);
  const [editingPartner, setEditingPartner] = useState<Partial<Partner> | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const [settingsForm, setSettingsForm] = useState<Settings>({
    eventDate: "",
    eventVenue: "",
    adminPassword: "",
    contactEmail: "",
    contactPhone: ""
  });

  // Verify and load data when token shifts
  useEffect(() => {
    if (token) {
      fetchAdminData();
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setLoginError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const result = await response.json();

      if (response.ok) {
        localStorage.setItem("admin_token", result.token);
        setToken(result.token);
        setPassword("");
      } else {
        setLoginError(result.error || "Invalid password.");
      }
    } catch (err) {
      setLoginError("Could not reach backend server.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
    } catch (e) {}
    
    localStorage.removeItem("admin_token");
    setToken("");
    setDbData(null);
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/data", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setDbData(data);
        setSettingsForm(data.settings);
      } else {
        // Token expired/invalid
        handleLogout();
      }
    } catch (err) {
      console.error("Failed to load admin data", err);
    } finally {
      setLoading(false);
    }
  };

  // Generic API requester to keep code clean
  const makeRequest = async (url: string, method: string, body: any) => {
    setActionLoading(true);
    setActionError("");
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      if (response.ok) {
        await fetchAdminData();
        onDataChange();
        return result;
      } else {
        setActionError(result.error || "Operation failed.");
        return null;
      }
    } catch (e) {
      setActionError("Network offline error.");
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  // METRICS HANDLERS
  const saveMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMetric) return;
    const isEdit = !!editingMetric.id;
    const url = isEdit ? `/api/admin/metrics/${editingMetric.id}` : "/api/admin/metrics";
    const method = isEdit ? "PUT" : "POST";
    const success = await makeRequest(url, method, editingMetric);
    if (success) {
      setEditingMetric(null);
    }
  };

  const deleteMetric = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this metric?")) {
      await makeRequest(`/api/admin/metrics/${id}`, "DELETE", null);
    }
  };

  // SPEAKERS HANDLERS
  const saveSpeaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpeaker) return;

    const isEdit = !!editingSpeaker.id;
    const url = isEdit ? `/api/admin/speakers/${editingSpeaker.id}` : "/api/admin/speakers";
    const method = isEdit ? "PUT" : "POST";

    const success = await makeRequest(url, method, editingSpeaker);
    if (success) {
      setEditingSpeaker(null);
    }
  };

  const deleteSpeaker = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this speaker?")) {
      await makeRequest(`/api/admin/speakers/${id}`, "DELETE", null);
    }
  };

  // PROGRAM HANDLERS
  const saveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;

    const isEdit = !!editingSlot.id;
    const url = isEdit ? `/api/admin/program/${editingSlot.id}` : "/api/admin/program";
    const method = isEdit ? "PUT" : "POST";

    const success = await makeRequest(url, method, editingSlot);
    if (success) {
      setEditingSlot(null);
    }
  };

  const deleteSlot = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this program block?")) {
      await makeRequest(`/api/admin/program/${id}`, "DELETE", null);
    }
  };

  // PARTNERS HANDLERS
  const savePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;

    const isEdit = !!editingPartner.id;
    const url = isEdit ? `/api/admin/partners/${editingPartner.id}` : "/api/admin/partners";
    const method = isEdit ? "PUT" : "POST";

    const success = await makeRequest(url, method, editingPartner);
    if (success) {
      setEditingPartner(null);
    }
  };

  const deletePartner = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this partner?")) {
      await makeRequest(`/api/admin/partners/${id}`, "DELETE", null);
    }
  };

  // TICKETS HANDLERS
  const saveTicket = async (ticketId: string, ticketData: any) => {
    await makeRequest(`/api/admin/tickets/${ticketId}`, "PUT", ticketData);
  };

  // SETTINGS HANDLERS
  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await makeRequest("/api/admin/settings", "PUT", settingsForm);
  };

  // Download Subscribers Database to CSV
  const triggerCsvDownload = () => {
    const downloadUrl = `/api/admin/subscribers/export`;
    
    // Create a temporary hidden link element
    const link = document.createElement("a");
    link.href = downloadUrl;
    // Set attachment cookies or authorization headers
    // Since it's a GET request download, we query directly. But browser won't standardly pass bearer tokens on normal href unless appended in search param,
    // so let's fetch with authorization bearer, convert to Blob, and download dynamically! This is extremely robust and avoids exposed tokens.
    setLoading(true);
    fetch(downloadUrl, {
      headers: { "Authorization": `Bearer ${token}` }
    })
    .then(response => {
      if (!response.ok) throw new Error("Unauthorized");
      return response.blob();
    })
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      link.href = blobUrl;
      link.setAttribute("download", "educational_forum_mailing_list.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    })
    .catch(err => {
      alert("Error compilation downloading mailing base: Unauthorized session.");
    })
    .finally(() => {
      setLoading(false);
    });
  };

  // RENDER: Authorization Login Panel
  if (!token) {
    return (
      <div className="mx-auto max-w-md my-12 p-8 rounded-3xl border border-slate-200/85 bg-white shadow-xl bg-gradient-to-b from-white to-slate-50/50 text-left" id="admin_login_box">
        <div className="flex items-center space-x-3 mb-6">
          <div className="rounded-xl bg-sky-50 p-3 text-sky-500">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">
              {lang === "ru" ? "Административная Панель" : "CMS Secure Portal"}
            </h2>
            <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              The Main Educational Event
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-2xs font-extrabold text-slate-400 uppercase tracking-widest font-mono mb-2 ml-1">
              {lang === "ru" ? "Введите пароль" : "Enter Administrative Password"}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-slate-200/80 bg-white/70 p-3.5 text-sm font-semibold tracking-widest text-slate-800 outline-hidden focus:border-sky-500 focus:bg-white focus:ring-3 focus:ring-sky-100"
              id="admin_password_input"
            />
          </div>

          {loginError && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3.5 flex items-start space-x-2 text-danger animate-shake" id="login_error_banner">
              <ShieldAlert className="h-4.5 w-4.5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-600">{loginError}</p>
            </div>
          )}

          <div className="pt-2 text-center">
            {loading ? (
              <button disabled className="w-full rounded-full bg-slate-300 p-3.5 flex items-center justify-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                <span className="text-xs font-bold text-slate-500">AUTHORIZING...</span>
              </button>
            ) : (
              <button type="submit" className="w-full rounded-full bg-slate-950 hover:bg-slate-800 text-white p-3.5 font-bold tracking-wider text-xs sm:text-sm shadow-md cursor-pointer transition">
                {lang === "ru" ? "Авторизоваться" : "LOG IN"}
              </button>
            )}
            <p className="text-4xs font-mono font-bold text-slate-400 tracking-wider uppercase mt-4">
              ⭐ default key: <span className="text-sky-500">admin</span>
            </p>
          </div>
        </form>
      </div>
    );
  }

  // Loading global state
  if (!dbData) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4" id="admin_loading_state">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
          Syncing Core CMS Modules...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8" id="admin_dashboard_root">
      {/* CMS Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-8 text-left">
        <div>
          <span className="rounded-full bg-sky-50 border border-sky-100 px-3 py-1 text-[10px] font-black text-sky-500 uppercase tracking-widest font-mono">
            🔐 Control Portal • Live Config
          </span>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {lang === "ru" ? "Управление Событием" : "CMS Editor Station"}
          </h1>
          <p className="mt-1 text-xs font-semibold text-slate-400 font-mono">
            {dbData.settings.eventVenue} | {dbData.settings.eventDate}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="self-start sm:self-center flex items-center space-x-1.5 rounded-full border border-red-150 bg-red-50/50 hover:bg-red-50 hover:border-red-350 text-red-600 font-semibold text-xs px-4 py-2 transition shadow-xs cursor-pointer"
          id="btn_admin_logout"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{lang === "ru" ? "Выйти из админки" : "Log out"}</span>
        </button>
      </div>

      {/* Tabs navigation list */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4 mb-8" id="admin_tab_row">
        {[
          { id: "metrics", label_ru: "Метрики", label_en: "Metrics Grid", badge: dbData.metrics?.length || 0, icon: Plus },
          { id: "subscribers", label_ru: "База Рассылки", label_en: "Mailing Base", badge: dbData.subscribers.length, icon: Users },
          { id: "speakers", label_ru: "Спикеры (+16)", label_en: "Speakers Deck", badge: dbData.speakers.length, icon: Award },
          { id: "program", label_ru: "Программа дня", label_en: "Program slots", badge: dbData.program.length, icon: Calendar },
          { id: "tickets", label_ru: "Билеты / UTM", label_en: "Tickets Layout", badge: dbData.tickets.length, icon: DollarSign },
          { id: "partners", label_ru: "Спонсоры и Партнеры", label_en: "Sponsors & Partners", badge: dbData.partners.length, icon: Landmark },
          { id: "settings", label_ru: "Глобальные настройки", label_en: "HQ Settings", icon: SettingsIcon }
        ].map((tab) => {
          const IconComp = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setCurrentTab(tab.id as AdminTab);
                setActionError("");
              }}
              className={`flex items-center space-x-1.5 rounded-full px-4.5 py-2 text-xs font-bold transition cursor-pointer select-none ${
                isActive 
                  ? "bg-slate-950 text-white shadow-xs font-black scale-102" 
                  : "bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-slate-200 text-slate-500"
              }`}
              id={`tab_select_${tab.id}`}
            >
              <IconComp className="h-3.5 w-3.5" />
              <span>{lang === "ru" ? tab.label_ru : tab.label_en}</span>
              {tab.badge !== undefined && (
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono leading-tight ${isActive ? "bg-white/25 text-white font-bold" : "bg-slate-200/80 text-slate-600 font-extrabold"}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ERROR FEEDBACK BANNER */}
      {actionError && (
        <div className="rounded-xl border border-red-150 bg-red-50 p-4 mb-6 flex items-start space-x-3 text-left animate-shake" id="admin_error_banner">
          <ShieldAlert className="h-5 w-5 text-red-500 mt-0.5" />
          <p className="text-xs font-bold text-red-600">{actionError}</p>
        </div>
      )}

      {/* RENDER ACTIVE TAB VIEW */}

      {/* TAB: METRICS CRUD */}
      {currentTab === "metrics" && (
        <div className="space-y-6" id="tab_metrics_view">
          <div className="flex border-b border-dashed border-slate-100 pb-4 justify-between items-center text-left">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">
                {lang === "ru" ? "Управление Метриками" : "Metrics Grid Content"}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === "ru" ? "Главные карточки с цифрами на стартовом экране." : "The primary statistics and numbers shown on the hero grid."}
              </p>
            </div>
            <button
              onClick={() => setEditingMetric({ value: "", label_en: "", label_ru: "", sublabel_en: "", sublabel_ru: "", order: (dbData.metrics?.length || 0) + 1 })}
              className="flex items-center space-x-1.5 rounded-full bg-slate-900 border hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{lang === "ru" ? "Добавить Метрику" : "Add Metric"}</span>
            </button>
          </div>

          {editingMetric && (
            <form onSubmit={saveMetric} className="rounded-3xl border border-slate-200 bg-slate-50/40 p-6 sm:p-8 space-y-5 text-left animate-slide-down">
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-3 mb-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                  {editingMetric.id ? "Редактирование Метрики" : "Добавление Метрики"}
                </h3>
                <button type="button" onClick={() => setEditingMetric(null)} className="rounded-full bg-slate-200 p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Big Value (e.g. 500+)</label>
                  <input type="text" required value={editingMetric.value || ""} onChange={(e) => setEditingMetric({...editingMetric, value: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden" />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Display Order</label>
                  <input type="number" required value={editingMetric.order || 1} onChange={(e) => setEditingMetric({...editingMetric, order: parseInt(e.target.value) || 1})} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Label (English) *</label>
                  <input type="text" required value={editingMetric.label_en || ""} onChange={(e) => setEditingMetric({...editingMetric, label_en: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden" />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Заголовок (Русский)</label>
                  <input type="text" value={editingMetric.label_ru || ""} onChange={(e) => setEditingMetric({...editingMetric, label_ru: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Sublabel (English)</label>
                  <input type="text" value={editingMetric.sublabel_en || ""} onChange={(e) => setEditingMetric({...editingMetric, sublabel_en: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden" />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Подзаголовок (Русский)</label>
                  <input type="text" value={editingMetric.sublabel_ru || ""} onChange={(e) => setEditingMetric({...editingMetric, sublabel_ru: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden" />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200/60">
                <button type="button" onClick={() => setEditingMetric(null)} className="rounded-full border border-slate-200 px-6 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">Cancel</button>
                <button type="submit" disabled={actionLoading} className="rounded-full bg-slate-950 hover:bg-slate-800 text-white px-6 py-2.5 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer">
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>Save changes</span>
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(dbData.metrics || []).map((m) => (
              <div key={m.id} className="rounded-2xl border border-slate-100 bg-white p-4 text-center flex flex-col justify-between shadow-xs">
                <div>
                  <span className="text-3xl font-black text-slate-800">{m.value}</span>
                  <h4 className="mt-1 text-sm font-bold text-slate-700">{m.label_en}</h4>
                  {m.sublabel_en && <p className="text-xs text-slate-500 mt-0.5">{m.sublabel_en}</p>}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-50 flex justify-center space-x-2">
                  <button onClick={() => setEditingMetric(m)} className="rounded-lg border border-slate-150 p-1.5 text-slate-500 hover:bg-slate-50/50 hover:text-slate-800 cursor-pointer"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteMetric(m.id)} className="rounded-lg border border-red-150 p-1.5 text-red-500 hover:bg-red-50 hover:border-red-250 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 1: SUBSCRIBERS LIST & CSV EXPORT */}
      {currentTab === "subscribers" && (
        <div className="space-y-6" id="tab_sub_view">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-dashed border-slate-100 pb-4 text-left">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">
                {lang === "ru" ? "Зарегистрированные подписчики" : "Newsletter subscriber logs"}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === "ru" ? "Все поступающие подписки записываются сюда в реальном времени." : "Every user who submits the bottom guide form is persistent here."}
              </p>
            </div>

            {dbData.subscribers.length > 0 && (
              <button
                onClick={triggerCsvDownload}
                className="flex items-center space-x-2 rounded-full bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 text-emerald-600 font-bold text-xs px-5 py-2.5 transition shadow-xs cursor-pointer"
                id="btn_export_csv"
              >
                <Download className="h-4 w-4" />
                <span>EXPORT TO EXCEL (.CSV)</span>
              </button>
            )}
          </div>

          {/* Subscribers Table List */}
          {dbData.subscribers.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-150 bg-slate-50/20 p-12 text-center text-slate-400 text-sm">
              No active registrations in database yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white" id="subscribers_table_scroller">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[600px]" id="subscribers_table">
                  <thead className="bg-slate-50 border-b border-slate-100 font-mono text-3xs font-extrabold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4">Timestamp (UTC)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                    {dbData.subscribers.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/40">
                        <td className="p-4 font-bold text-slate-800">{sub.name}</td>
                        <td className="p-4 font-mono text-slate-500 select-all">{sub.email}</td>
                        <td className="p-4 font-mono select-all">{sub.phone || "--"}</td>
                        <td className="p-4 text-slate-400">{new Date(sub.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SPEAKERS CRUD */}
      {currentTab === "speakers" && (
        <div className="space-y-6" id="tab_speakers_view">
          <div className="flex border-b border-dashed border-slate-100 pb-4 justify-between items-center text-left">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">
                {lang === "ru" ? "Управление спикерами" : "Speakers Deck Content"}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === "ru" ? "Добавляйте, изменяйте или очищайте спикеров форума." : "Manage listing properties, graduation years, and descriptions for your event presenters."}
              </p>
            </div>

            <button
              onClick={() => setEditingSpeaker({
                name_ru: "", name_en: "", university: "Stanford University", major_ru: "", major_en: "",
                admissionYear: "Class of 2028", story_ru: "", story_en: "", lectureTopic_ru: "", lectureTopic_en: "",
                lectureTime: "11:15 am", colorTheme: "blue", isFeatured: false
              })}
              className="flex items-center space-x-1.5 rounded-full bg-slate-900 border hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 transition cursor-pointer"
              id="btn_add_speaker"
            >
              <Plus className="h-4 w-4" />
              <span>{lang === "ru" ? "Добавить спикера" : "Add Presenter"}</span>
            </button>
          </div>

          {/* Forms Drawer overlay for Adding/Editing Speaker */}
          {editingSpeaker && (
            <form onSubmit={saveSpeaker} className="rounded-3xl border border-slate-200 bg-slate-50/40 p-6 sm:p-8 space-y-5 text-left animate-slide-down" id="speaker_edit_form">
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-3 mb-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                  {editingSpeaker.id ? (lang === "ru" ? "Редактирование Спикера" : "Edit Presenter Properties") : (lang === "ru" ? "Добавление Спикера" : "Register New Speaker Deck")}
                </h3>
                <button 
                  type="button" 
                  onClick={() => setEditingSpeaker(null)} 
                  className="rounded-full bg-slate-200 p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Grid Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Name (English) *</label>
                  <input
                    type="text" required
                    value={editingSpeaker.name_en || ""}
                    onChange={(e) => setEditingSpeaker({...editingSpeaker, name_en: e.target.value})}
                    placeholder="Asel Alimzhanova"
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Имя (Русский)</label>
                  <input
                    type="text"
                    value={editingSpeaker.name_ru || ""}
                    onChange={(e) => setEditingSpeaker({...editingSpeaker, name_ru: e.target.value})}
                    placeholder="Асель Алимжанова"
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">University *</label>
                  <select
                    value={editingSpeaker.university || ""}
                    onChange={(e) => setEditingSpeaker({...editingSpeaker, university: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden"
                  >
                    <option value="Harvard University">Harvard University</option>
                    <option value="Stanford University">Stanford University</option>
                    <option value="MIT">MIT</option>
                    <option value="Columbia University">Columbia University</option>
                    <option value="University of Oxford">University of Oxford</option>
                    <option value="University of Cambridge">University of Cambridge</option>
                    <option value="Nazarbayev University">Nazarbayev University</option>
                    <option value="Princeton University">Princeton University</option>
                    <option value="Yale University">Yale University</option>
                    <option value="UPenn Wharton">UPenn Wharton</option>
                    <option value="California Institute of Technology">Caltech</option>
                    <option value="Cornell University">Cornell University</option>
                    <option value="UCLA">UCLA</option>
                    <option value="University of Chicago">University of Chicago</option>
                    <option value="Duke University">Duke University</option>
                  </select>
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Graduation Class Year</label>
                  <input
                    type="text"
                    value={editingSpeaker.admissionYear || ""}
                    onChange={(e) => setEditingSpeaker({...editingSpeaker, admissionYear: e.target.value})}
                    placeholder="Class of 2028"
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Avatar Gradients Theme</label>
                  <select
                    value={editingSpeaker.colorTheme || ""}
                    onChange={(e) => setEditingSpeaker({...editingSpeaker, colorTheme: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden animate-fade-in"
                  >
                    <option value="blue">Blue</option>
                    <option value="purple">Purple</option>
                    <option value="rose">Rose</option>
                    <option value="cyan">Cyan</option>
                    <option value="indigo">Indigo</option>
                    <option value="teal">Teal</option>
                    <option value="amber">Amber</option>
                    <option value="orange">Orange</option>
                    <option value="slate">Slate Dark</option>
                    <option value="emerald">Emerald</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Major (English) *</label>
                  <input
                    type="text" required
                    value={editingSpeaker.major_en || ""}
                    onChange={(e) => setEditingSpeaker({...editingSpeaker, major_en: e.target.value})}
                    placeholder="Computer Science"
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Специальность (Русский)</label>
                  <input
                    type="text"
                    value={editingSpeaker.major_ru || ""}
                    onChange={(e) => setEditingSpeaker({...editingSpeaker, major_ru: e.target.value})}
                    placeholder="Компьютерные Науки"
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Lecture Topic (English) *</label>
                  <input
                    type="text" required
                    value={editingSpeaker.lectureTopic_en || ""}
                    onChange={(e) => setEditingSpeaker({...editingSpeaker, lectureTopic_en: e.target.value})}
                    placeholder="Personal Branding Strategy..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Тема выступления (Русский)</label>
                  <input
                    type="text"
                    value={editingSpeaker.lectureTopic_ru || ""}
                    onChange={(e) => setEditingSpeaker({...editingSpeaker, lectureTopic_ru: e.target.value})}
                    placeholder="Стратегия Личного Бренда..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Presentation Timings</label>
                  <input
                    type="text"
                    value={editingSpeaker.lectureTime || ""}
                    onChange={(e) => setEditingSpeaker({...editingSpeaker, lectureTime: e.target.value})}
                    placeholder="11:15 am"
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Show on Landing Page Featured Grid</label>
                  <select
                    value={String(editingSpeaker.isFeatured)}
                    onChange={(e) => setEditingSpeaker({...editingSpeaker, isFeatured: e.target.value === "true"})}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden"
                  >
                    <option value="true">Yes, Featured Primary Grid</option>
                    <option value="false">No, Collapsed/Standard List</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Detailed Story Biography (English)</label>
                  <textarea
                    rows={4}
                    value={editingSpeaker.story_en || ""}
                    onChange={(e) => setEditingSpeaker({...editingSpeaker, story_en: e.target.value})}
                    placeholder="Admitted with a 3% acceptance rate. Dedicated to social welfare..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 ml-1">Биография и советы (Русский)</label>
                  <textarea
                    rows={4}
                    value={editingSpeaker.story_ru || ""}
                    onChange={(e) => setEditingSpeaker({...editingSpeaker, story_ru: e.target.value})}
                    placeholder="Поступила в Гарвард после успешного преодоления конкурса..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-700 outline-hidden"
                  />
                </div>
              </div>

              {/* Loader controls */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200/60">
                <button
                  type="button" onClick={() => setEditingSpeaker(null)}
                  className="rounded-full border border-slate-200 px-6 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={actionLoading}
                  className="rounded-full bg-slate-950 hover:bg-slate-800 text-white px-6 py-2.5 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>Save changes</span>
                </button>
              </div>
            </form>
          )}

          {/* Speakers List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" id="admin_speakers_list">
            {dbData.speakers.map((s) => (
              <div key={s.id} className="rounded-2xl border border-slate-100 bg-white p-4 text-left flex flex-col justify-between shadow-xs">
                <div>
                  <span className="text-[10px] uppercase tracking-wide font-mono font-bold text-sky-500 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100/60">
                    {s.university}
                  </span>
                  <h4 className="mt-2 text-sm font-extrabold text-slate-800">{s.name_en}</h4>
                  <p className="text-4xs font-mono font-bold text-slate-400 uppercase tracking-widest mt-0.5">{s.lectureTime} | {s.isFeatured ? "Featured" : "Standard List"}</p>
                  <p className="mt-1.5 text-2xs font-semibold text-slate-500 line-clamp-1">💬 {s.lectureTopic_en}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-50 flex justify-end space-x-2">
                  <button
                    onClick={() => setEditingSpeaker(s)}
                    className="rounded-lg border border-slate-150 p-1.5 text-slate-500 hover:bg-slate-50/50 hover:text-slate-800 cursor-pointer"
                    title="Edit presenter"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteSpeaker(s.id)}
                    className="rounded-lg border border-red-150 p-1.5 text-red-500 hover:bg-red-50 hover:border-red-250 cursor-pointer"
                    title="Delete presenter"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PROGRAM PANEL */}
      {currentTab === "program" && (
        <div className="space-y-6" id="tab_program_view">
          <div className="flex border-b border-dashed border-slate-100 pb-4 justify-between items-center text-left">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">Русские/Английские Слот-сессии расписания</h2>
              <p className="text-xs text-slate-400">Manage chronology details and reference mapping to speakers.</p>
            </div>

            <button
              onClick={() => setEditingSlot({ time: "09:30 - 10:15", title_en: "", title_ru: "", description_en: "", description_ru: "", speakerId: "" })}
              className="flex items-center space-x-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add custom slot</span>
            </button>
          </div>

          {editingSlot && (
            <form onSubmit={saveSlot} className="rounded-3xl border border-slate-200 bg-slate-50/40 p-6 space-y-4 text-left animate-slide-down">
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-800">Add or Edit schedule row</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 select-none">Time Slot interval *</label>
                  <input 
                    type="text" required value={editingSlot.time || ""}
                    onChange={(e) => setEditingSlot({...editingSlot, time: e.target.value})}
                    placeholder="10:30 - 11:15"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-700 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1 select-none">Linked Presenter Profile</label>
                  <select
                    value={editingSlot.speakerId || ""}
                    onChange={(e) => setEditingSlot({...editingSlot, speakerId: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-700 bg-white"
                  >
                    <option value="">-- No Speaker / General Slot --</option>
                    {dbData.speakers.map(s => (
                      <option key={s.id} value={s.id}>{s.name_en} ({s.university})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Title (English) *</label>
                  <input 
                    type="text" required value={editingSlot.title_en || ""}
                    onChange={(e) => setEditingSlot({...editingSlot, title_en: e.target.value})}
                    placeholder="Grand Keynote Opening"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-700 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Название (Русский)</label>
                  <input 
                    type="text" value={editingSlot.title_ru || ""}
                    onChange={(e) => setEditingSlot({...editingSlot, title_ru: e.target.value})}
                    placeholder="Торжественное Открытие"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-700 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Description (English)</label>
                  <textarea 
                    rows={3} value={editingSlot.description_en || ""}
                    onChange={(e) => setEditingSlot({...editingSlot, description_en: e.target.value})}
                    placeholder="Detailed session breakdowns..."
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-700 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Описание (Русский)</label>
                  <textarea 
                    rows={3} value={editingSlot.description_ru || ""}
                    onChange={(e) => setEditingSlot({...editingSlot, description_ru: e.target.value})}
                    placeholder="Подробный тайминг сессии..."
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-700 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 border-t pt-3 border-slate-200/60">
                <button type="button" onClick={() => setEditingSlot(null)} className="rounded-full border px-5 py-2 text-xs text-slate-500 font-bold hover:bg-slate-100 cursor-pointer">Cancel</button>
                <button type="submit" className="rounded-full bg-slate-900 text-white px-5 py-2 text-xs font-bold hover:bg-slate-800 cursor-pointer">Save Slot info</button>
              </div>
            </form>
          )}

          {/* List display */}
          <div className="space-y-3 text-left">
            {dbData.program.map(p => (
              <div key={p.id} className="rounded-xl border border-slate-100 p-4 bg-white hover:border-slate-200 flex justify-between items-center gap-4">
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-xs font-black bg-slate-50 px-2 py-1 border rounded-lg text-slate-500">{p.time}</span>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800">{p.title_en}</h4>
                    {p.speakerId && (
                      <span className="text-4xs font-mono font-bold text-sky-400 uppercase tracking-wider block">Linked Profile exists</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button onClick={() => setEditingSlot(p)} className="rounded-lg border p-1.5 text-slate-400 hover:bg-slate-50/50 hover:text-slate-800 cursor-pointer"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteSlot(p.id)} className="rounded-lg border p-1.5 text-red-400 hover:bg-red-50 hover:border-red-200 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: TICKETS EDITOR PANEL */}
      {currentTab === "tickets" && (
        <div className="space-y-6" id="tab_tickets_view">
          <div className="border-b border-dashed border-slate-100 pb-4 text-left">
            <h2 className="text-lg font-extrabold text-slate-800">Tickets price level & Atttibution links</h2>
            <p className="text-xs text-slate-400">Dynamically update individual prices and customize transactional UTM query parameters.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {dbData.tickets.map((t) => (
              <TicketEditor key={t.id} ticket={t} lang={lang} onSave={saveTicket} actionLoading={actionLoading} />
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PARTNERS & SPONSORS CRUD */}
      {currentTab === "partners" && (
        <div className="space-y-6" id="tab_partners_view">
          <div className="flex border-b border-dashed border-slate-100 pb-4 justify-between items-center text-left">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">HQ Sponsors & Ecosystem Partners</h2>
              <p className="text-xs text-slate-400">Manage sponsors and partners that appear at the bottom.</p>
            </div>

            <button
              onClick={() => setEditingPartner({ name: "", role_en: "", role_ru: "", tier: "sponsor" })}
              className="flex items-center space-x-1.5 rounded-full bg-slate-900 text-white font-bold text-xs px-4 py-2 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Sponsor / Partner</span>
            </button>
          </div>

          {editingPartner && (
            <form onSubmit={savePartner} className="rounded-3xl border border-slate-200 bg-slate-50/40 p-6 space-y-4 text-left animate-slide-down">
              <h3 className="font-extrabold text-xs text-slate-800">Create or modify sponsor/partner log</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Institution Name *</label>
                  <input 
                    type="text" required value={editingPartner.name || ""}
                    onChange={(e) => setEditingPartner({...editingPartner, name: e.target.value})}
                    placeholder="Astana Technopark"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-700 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Target Partnership Level Tier</label>
                  <select
                    value={editingPartner.tier || "sponsor"}
                    onChange={(e) => setEditingPartner({...editingPartner, tier: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-700 bg-white"
                  >
                    <option value="general">General Venue Partner [Primary banner]</option>
                    <option value="sponsor">Academic Language Sponsor [Large layout card]</option>
                    <option value="partner">Information Outreach Regular Partner [Small flat badges]</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Role attribution description (English)</label>
                  <input 
                    type="text" value={editingPartner.role_en || ""}
                    onChange={(e) => setEditingPartner({...editingPartner, role_en: e.target.value})}
                    placeholder="General Sponsor & Official Venue"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-700 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Детали роли / описание (Русский)</label>
                  <input 
                    type="text" value={editingPartner.role_ru || ""}
                    onChange={(e) => setEditingPartner({...editingPartner, role_ru: e.target.value})}
                    placeholder="Генеральный партнер, место проведения"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold text-slate-700 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 border-t pt-3 border-slate-200/60">
                <button type="button" onClick={() => setEditingPartner(null)} className="rounded-full border px-5 py-2 text-xs text-slate-500 font-bold hover:bg-slate-100 cursor-pointer">Cancel</button>
                <button type="submit" className="rounded-full bg-slate-900 text-white px-5 py-2 text-xs font-bold hover:bg-slate-800 cursor-pointer">Save Partner details</button>
              </div>
            </form>
          )}

          {/* Regular Lists */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {dbData.partners.map(p => (
              <div key={p.id} className="rounded-xl border border-slate-100 p-4 bg-white flex justify-between items-center gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold font-mono text-indigo-400 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100/50">
                    {p.tier}
                  </span>
                  <h4 className="mt-2 text-sm font-extrabold text-slate-800">{p.name}</h4>
                  <p className="text-4xs text-slate-400 font-mono italic">{p.role_en || ""}</p>
                </div>

                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <button onClick={() => setEditingPartner(p)} className="rounded border p-1 text-slate-400 hover:text-slate-800 cursor-pointer"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deletePartner(p.id)} className="rounded border p-1 text-red-400 hover:text-red-600 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: GLOBAL CONFIG SETTINGS */}
      {currentTab === "settings" && (
        <form onSubmit={saveSettings} className="rounded-3xl border border-slate-200/80 bg-slate-50/40 p-6 space-y-5 text-left max-w-2xl mx-auto animate-scale-up" id="tab_settings_view">
          <h2 className="text-base sm:text-lg font-black text-slate-800 border-b pb-3 border-slate-200/60 flex items-center space-x-2">
            <SettingsIcon className="h-5 w-5 text-sky-400" />
            <span>Event Coordination & Security credentials</span>
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5 ml-1">Event Date Label</label>
              <input
                type="text" required value={settingsForm.eventDate}
                onChange={(e) => setSettingsForm({...settingsForm, eventDate: e.target.value})}
                placeholder="June 26, 2026"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5 ml-1">Location Venue details</label>
              <input
                type="text" required value={settingsForm.eventVenue}
                onChange={(e) => setSettingsForm({...settingsForm, eventVenue: e.target.value})}
                placeholder="Astana Technopark, Block C4"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700 outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5 ml-1">Global Support Email</label>
                <input
                  type="email" required value={settingsForm.contactEmail}
                  onChange={(e) => setSettingsForm({...settingsForm, contactEmail: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-700 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5 ml-1">Global Callback Phone</label>
                <input
                  type="text" required value={settingsForm.contactPhone}
                  onChange={(e) => setSettingsForm({...settingsForm, contactPhone: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-700 outline-hidden"
                />
              </div>
            </div>

            <div className="border-t border-dashed border-slate-200/80 pt-4">
              <label className="block text-4xs font-bold text-red-500 uppercase tracking-widest font-mono mb-1.5 ml-1">Modify Admin Panel Password ⚠️</label>
              <input
                type="text" required value={settingsForm.adminPassword || "admin"}
                onChange={(e) => setSettingsForm({...settingsForm, adminPassword: e.target.value})}
                className="w-full rounded-xl border border-red-150 bg-red-50/20 p-3 text-xs font-mono font-bold text-slate-700 outline-hidden focus:border-red-400"
              />
              <p className="mt-1.5 text-4xs text-slate-400 font-bold tracking-wider font-mono">WARNING: Changing password updates the main credentials instantly. Keep this documented!</p>
            </div>
          </div>

          <div className="flex justify-end pt-3 text-right">
            <button
              type="submit" disabled={actionLoading}
              className="rounded-full bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 shadow-sm transition cursor-pointer"
            >
              {actionLoading ? "SAVING CONFIG..." : "SAVE GLOBAL CONFIG"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}


// Mini inline helper to manage Ticket parameter items
interface TicketEditorProps {
  key?: string;
  ticket: Ticket;
  lang: "ru" | "en";
  actionLoading: boolean;
  onSave: (ticketId: string, ticketData: any) => Promise<void>;
}

function TicketEditor({ ticket, lang, onSave, actionLoading }: TicketEditorProps) {
  const [price, setPrice] = useState(ticket.price);
  const [url, setUrl] = useState(ticket.url);
  const [utmSource, setUtmSource] = useState(ticket.utm_source);
  const [utmMedium, setUtmMedium] = useState(ticket.utm_medium);
  const [utmCampaign, setUtmCampaign] = useState(ticket.utm_campaign);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(ticket.id, {
      price,
      url,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-150 p-5 bg-white text-left space-y-4 shadow-xs" id={`ticket_editor_${ticket.id}`}>
      <div>
        <h4 className="text-xs font-extrabold text-slate-800">{lang === "ru" ? ticket.name_ru : ticket.name_en}</h4>
        <span className="text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono">TICKET ID: {ticket.id}</span>
      </div>

      <div>
        <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Pricing text</label>
        <input
          type="text" required value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-lg border border-slate-200 p-1.5 text-xs font-semibold text-slate-700 font-mono"
        />
      </div>

      <div>
        <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Destination Booking link URL</label>
        <input
          type="url" required value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-lg border border-slate-200 p-1.5 text-xs font-semibold text-slate-500 font-mono select-all"
        />
      </div>

      {/* UTM properties */}
      <div className="border-t border-dashed border-slate-100 pt-3 space-y-2.5">
        <span className="block text-4xs font-extrabold text-sky-400 uppercase tracking-widest font-mono">UTM attribution attributes</span>
        
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-5xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">utm_source</label>
            <input
              type="text" value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
              className="w-full rounded border p-1 text-[10px] font-mono select-all text-slate-500"
            />
          </div>
          <div>
            <label className="block text-5xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">utm_medium</label>
            <input
              type="text" value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
              className="w-full rounded border p-1 text-[10px] font-mono select-all text-slate-500"
            />
          </div>
          <div>
            <label className="block text-5xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">utm_campaign</label>
            <input
              type="text" value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
              className="w-full rounded border p-1 text-[10px] font-mono select-all text-slate-500"
            />
          </div>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          type="submit" disabled={actionLoading}
          className={`rounded-full px-5 py-2 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
            saved 
              ? "bg-emerald-500 text-white shadow-xs" 
              : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {saved ? <Check className="h-3.5 w-3.5" /> : null}
          <span>{saved ? "Saved" : "Save Changes"}</span>
        </button>
      </div>
    </form>
  );
}
