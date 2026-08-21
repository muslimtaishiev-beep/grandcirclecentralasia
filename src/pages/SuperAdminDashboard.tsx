import React, { useState } from "react";
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
  Shield, 
  Activity, 
  RefreshCw,
  Lock,
  Zap,
  HardDrive
} from "lucide-react";

// Types matching multi-tenant architecture
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

const INITIAL_PROJECTS: OrganizationProject[] = [
  {
    id: "proj_gc_2026",
    name: "Grand Circle Central Asia",
    slug: "grand-circle",
    framework: "SaaS Testing Engine v2",
    status: "READY font-mono",
    updatedAt: "2m ago",
    domain: "grandcircle.kz",
    activeSessions: 14,
    totalSubmissions: 1420,
    storageUsedMb: 412,
    apiKey: "gc_live_9f8d7c6b5a4e3f21",
    proctoringFlags: {
      gazeAway: true,
      faceCount: true,
      handTracking: true,
      audioAnalysis: true,
      phoneDetection: true
    }
  },
  {
    id: "proj_bis_2026",
    name: "Бишкекская Международная Школа #1",
    slug: "bis-edu",
    framework: "Proctoring Core",
    status: "READY font-mono",
    updatedAt: "14m ago",
    domain: "bis.edu.kg",
    activeSessions: 3,
    totalSubmissions: 380,
    storageUsedMb: 128,
    apiKey: "bis_live_8a7b6c5d4e3f21a0",
    proctoringFlags: {
      gazeAway: true,
      faceCount: true,
      handTracking: false,
      audioAnalysis: true,
      phoneDetection: true
    }
  },
  {
    id: "proj_oxford_2026",
    name: "Oxford Academy Language Center",
    slug: "oxford-kg",
    framework: "CEFR Testing Engine",
    status: "READY font-mono",
    updatedAt: "1h ago",
    domain: "oxford.kg",
    activeSessions: 0,
    totalSubmissions: 215,
    storageUsedMb: 94,
    apiKey: "oxf_live_1a2b3c4d5e6f7a8b",
    proctoringFlags: {
      gazeAway: true,
      faceCount: true,
      handTracking: true,
      audioAnalysis: false,
      phoneDetection: false
    }
  }
];

const INITIAL_LOGS: VercelSystemLog[] = [
  {
    id: "log_991",
    timestamp: "16:48:12",
    orgSlug: "grand-circle",
    level: "INFO",
    route: "POST /api/proctoring/upload-evidence",
    message: "200 OK — evidence package uploaded to Drive (6 snapshots, 1 report.md)",
    durationMs: 412
  },
  {
    id: "log_992",
    timestamp: "16:45:01",
    orgSlug: "bis-edu",
    level: "SUCCESS",
    route: "POST /api/gas [submitTest]",
    message: "200 OK — student ShortID 570490 result saved to Sheets + Firestore",
    durationMs: 820
  },
  {
    id: "log_993",
    timestamp: "16:40:22",
    orgSlug: "grand-circle",
    level: "WARN",
    route: "POST /api/gas [suspendTest]",
    message: "200 OK — student session suspended due to window blur event",
    durationMs: 190
  },
  {
    id: "log_994",
    timestamp: "16:30:00",
    orgSlug: "oxford-kg",
    level: "INFO",
    route: "GET /api/public/check-retake/201026",
    message: "200 OK — retake authorization verified via Firestore cache",
    durationMs: 45
  }
];

export default function SuperAdminDashboard() {
  const [projects, setProjects] = useState<OrganizationProject[]>(INITIAL_PROJECTS);
  const [logs, setLogs] = useState<VercelSystemLog[]>(INITIAL_LOGS);
  const [activeTab, setActiveTab] = useState<"projects font-mono" | "deployments" | "logs" | "storage" | "flags" | "settings">("projects font-mono font-mono");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // New Project Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newDomain, setNewDomain] = useState("");

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    const slug = newOrgSlug.trim() || newOrgName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const newProj: OrganizationProject = {
      id: "proj_" + Math.random().toString(36).slice(2, 9),
      name: newOrgName,
      slug,
      framework: "SaaS Testing Engine v2",
      status: "READY font-mono",
      updatedAt: "Just now",
      domain: newDomain || `${slug}.edu.kg`,
      activeSessions: 0,
      totalSubmissions: 0,
      storageUsedMb: 0,
      apiKey: `${slug.slice(0, 4)}_live_${Math.random().toString(36).slice(2, 12)}`,
      proctoringFlags: {
        gazeAway: true,
        faceCount: true,
        handTracking: true,
        audioAnalysis: true,
        phoneDetection: true
      }
    };

    setProjects([newProj, ...projects]);
    setLogs([
      {
        id: "log_" + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        orgSlug: slug,
        level: "SUCCESS",
        route: "POST /api/tenants/create",
        message: `Project created: ${newOrgName} (${slug})`,
        durationMs: 84
      },
      ...logs
    ]);

    setIsModalOpen(false);
    setNewOrgName("");
    setNewOrgSlug("");
    setNewDomain("");
  };

  const toggleFlag = (projectId: string, flagKey: keyof OrganizationProject["proctoringFlags"]) => {
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          proctoringFlags: {
            ...p.proctoringFlags,
            [flagKey]: !p.proctoringFlags[flagKey]
          }
        };
      }
      return p;
    }));
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#000000] text-[#ededed] font-sans antialiased selection:bg-[#fff] selection:text-[#000]">
      
      {/* ── VERCEL HEADER ── */}
      <header className="border-b border-[#333333] bg-[#000000] sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          
          {/* Breadcrumb / Scope Selector */}
          <div className="flex items-center gap-3">
            {/* Vercel Logo Triangle */}
            <div className="w-5 h-5 flex items-center justify-center">
              <svg width="16" height="14" viewBox="0 0 76 65" fill="none">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="#FFFFFF" />
              </svg>
            </div>
            <span className="text-[#444444] font-light">/</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#ffffff]">Super Admin</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#111111] text-[#888888] border border-[#333333]">Hobby / Enterprise</span>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-2 bg-[#111111] border border-[#333333] px-2.5 py-1 rounded-md text-[#888888]">
              <Search className="w-3.5 h-3.5" />
              <span>Search projects...</span>
              <kbd className="font-mono text-[10px] bg-[#222222] text-[#aaaaaa] px-1 rounded border border-[#333333]">⌘K</kbd>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-[#ffffff] hover:bg-[#ccc] text-[#000000] font-medium px-3 py-1.5 rounded-md transition text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Project</span>
            </button>
          </div>
        </div>

        {/* ── VERCEL TAB NAVIGATION ── */}
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex items-center gap-6 text-xs text-[#888888] border-t border-[#111111] pt-1 font-medium overflow-x-auto">
          {[
            { id: "projects", label: "Projects", icon: Folder },
            { id: "deployments", label: "Live Sessions", icon: Activity },
            { id: "logs", label: "Logs", icon: Terminal },
            { id: "storage", label: "Storage", icon: Database },
            { id: "flags", label: "Feature Flags", icon: Sliders },
            { id: "settings", label: "Settings & API Keys", icon: Settings },
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

        {/* ── TAB 1: PROJECTS (ORGANIZATIONS) ── */}
        {(activeTab === "projects" || activeTab === ("projects font-mono" as any)) && (
          <div className="space-y-6">
            
            {/* Search & Filter Bar */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Filter projects by name or domain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#333333] rounded-md pl-9 pr-3 py-1.5 text-xs text-[#ededed] placeholder-[#666666] focus:outline-none focus:border-[#666666] transition font-sans"
                />
              </div>
              <div className="text-xs text-[#888888] font-mono">
                Showing {filteredProjects.length} of {projects.length} Projects
              </div>
            </div>

            {/* Vercel Grid of Project Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredProjects.map((project) => (
                <div 
                  key={project.id}
                  className="bg-[#0a0a0a] border border-[#333333] hover:border-[#666666] rounded-lg p-5 transition flex flex-col justify-between group space-y-4 shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#50e3c2]" title="Ready" />
                        <h3 className="font-semibold text-sm text-[#ffffff] group-hover:underline">{project.name}</h3>
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

                  {/* Operational Metrics */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#1a1a1a] text-xs">
                    <div>
                      <div className="text-[10px] text-[#666666] uppercase font-mono">Active Sessions</div>
                      <div className="font-bold text-[#ededed] font-mono mt-0.5">{project.activeSessions} LIVE</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#666666] uppercase font-mono">Submissions</div>
                      <div className="font-bold text-[#ededed] font-mono mt-0.5">{project.totalSubmissions} total</div>
                    </div>
                  </div>

                  {/* Footer info */}
                  <div className="flex items-center justify-between text-[11px] text-[#666666] font-mono pt-1">
                    <span>{project.framework}</span>
                    <span>Updated {project.updatedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 2: LIVE SESSIONS (DEPLOYMENTS) ── */}
        {activeTab === "deployments" && (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#ffffff]">Live Student Exam Sessions</h3>
                <p className="text-xs text-[#888888] mt-0.5">Real-time status of students taking proctored exams across all organizations</p>
              </div>
              <span className="text-xs font-mono text-[#50e3c2] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#50e3c2] animate-pulse" />
                <span>17 Active Connections</span>
              </span>
            </div>

            <div className="border border-[#222222] rounded-md overflow-hidden font-mono text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#111111] text-[#666666] text-[10px] uppercase border-b border-[#222222]">
                  <tr>
                    <th className="py-2.5 px-4">Organization</th>
                    <th className="py-2.5 px-4">Student ID</th>
                    <th className="py-2.5 px-4">Phase</th>
                    <th className="py-2.5 px-4">Proctoring Telemetry</th>
                    <th className="py-2.5 px-4 font-right text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  <tr className="hover:bg-[#111111]/50">
                    <td className="py-3 px-4 font-bold text-[#ffffff]">Grand Circle</td>
                    <td className="py-3 px-4 text-[#888888]">short_570490</td>
                    <td className="py-3 px-4 text-[#888888]">Main (Question 8/14)</td>
                    <td className="py-3 px-4 text-[#50e3c2]">Face: 1 | Gaze: Center | Hands: In Frame</td>
                    <td className="py-3 px-4 text-right">
                      <span className="bg-[#112211] text-[#50e3c2] border border-[#224422] px-2 py-0.5 rounded text-[10px]">PASSING</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-[#111111]/50">
                    <td className="py-3 px-4 font-bold text-[#ffffff]">Grand Circle</td>
                    <td className="py-3 px-4 text-[#888888]">short_608341</td>
                    <td className="py-3 px-4 text-[#888888]">English (Question 12/45)</td>
                    <td className="py-3 px-4 text-[#f5a623]">Tab Switch Detected (1x)</td>
                    <td className="py-3 px-4 text-right">
                      <span className="bg-[#221a00] text-[#f5a623] border border-[#443300] px-2 py-0.5 rounded text-[10px]">FLAGGED</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-[#111111]/50">
                    <td className="py-3 px-4 font-bold text-[#ffffff]">BIS School #1</td>
                    <td className="py-3 px-4 text-[#888888]">short_185424</td>
                    <td className="py-3 px-4 text-[#888888]">Main (Question 2/10)</td>
                    <td className="py-3 px-4 text-[#50e3c2]">Face: 1 | Gaze: Center | Hands: In Frame</td>
                    <td className="py-3 px-4 text-right">
                      <span className="bg-[#112211] text-[#50e3c2] border border-[#224422] px-2 py-0.5 rounded text-[10px]">PASSING</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 3: LOGS ── */}
        {activeTab === "logs" && (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#ffffff]">Vercel Edge & Proctoring Logs</h3>
                <p className="text-xs text-[#888888] mt-0.5">Real-time HTTP requests and proctoring violation payloads</p>
              </div>
              <button 
                onClick={() => setLogs([...logs])}
                className="bg-[#111111] hover:bg-[#222222] border border-[#333333] px-3 py-1 rounded text-xs text-[#888888] hover:text-[#ffffff] transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="font-mono text-xs space-y-1.5 bg-[#000000] border border-[#222222] p-4 rounded-md max-h-[450px] overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 py-1 border-b border-[#111111] last:border-none">
                  <span className="text-[#555555] text-[11px] whitespace-nowrap">[{log.timestamp}]</span>
                  <span className={`text-[10px] px-1 rounded font-bold ${
                    log.level === "SUCCESS" ? "bg-[#112211] text-[#50e3c2]" : log.level === "WARN" ? "bg-[#221a00] text-[#f5a623]" : "bg-[#221111] text-[#ff0000]"
                  }`}>
                    {log.level}
                  </span>
                  <span className="text-[#888888]">{log.route}</span>
                  <span className="text-[#ededed] flex-1">{log.message}</span>
                  <span className="text-[#444444] text-[11px] font-mono">{log.durationMs}ms</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 4: STORAGE & DRIVE ── */}
        {activeTab === "storage" && (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-[#ffffff]">Storage & Evidence Vault</h3>
              <p className="text-xs text-[#888888] mt-0.5">Google Drive and Firestore storage distribution per tenant organization</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
              {projects.map((p) => (
                <div key={p.id} className="bg-[#111111] border border-[#222222] p-4 rounded-md space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#ffffff]">{p.name}</span>
                    <HardDrive className="w-4 h-4 text-[#666666]" />
                  </div>
                  <div className="text-2xl font-bold text-[#50e3c2]">{p.storageUsedMb} MB</div>
                  <div className="w-full bg-[#222222] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#50e3c2] h-full" style={{ width: `${Math.min(100, (p.storageUsedMb / 1024) * 100)}%` }} />
                  </div>
                  <div className="text-[10px] text-[#666666] flex justify-between">
                    <span>Google Drive Vault</span>
                    <span>Limit: 15 GB</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 5: FEATURE FLAGS (TOGGLE DETECTORS) ── */}
        {activeTab === "flags" && (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-[#ffffff]">Proctoring Feature Flags</h3>
              <p className="text-xs text-[#888888] mt-0.5">Enable or disable specific AI ML detectors per organization in real-time</p>
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
                      { key: "gazeAway", label: "Gaze Tracking" },
                      { key: "faceCount", label: "Face Detector" },
                      { key: "handTracking", label: "Hand Tracking" },
                      { key: "audioAnalysis", label: "Audio Analysis" },
                      { key: "phoneDetection", label: "Phone Detection" },
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
                          <div className="text-[10px] mt-0.5">{enabled ? "● ENABLED" : "○ DISABLED"}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 6: SETTINGS & API KEYS ── */}
        {activeTab === "settings" && (
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-[#ffffff]">API Keys & Tenant Credentials</h3>
              <p className="text-xs text-[#888888] mt-0.5">Use these keys in client headers (`x-tenant-api-key`) to integrate proctoring widgets</p>
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
                      <span>{copiedKeyId === p.id ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ── NEW PROJECT MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg max-w-md w-full p-6 space-y-6 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#ffffff]">Create New Organization Project</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#666666] hover:text-[#ffffff]">✕</button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#888888] mb-1">Organization Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Bishkek International School"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full bg-[#111111] border border-[#333333] rounded px-3 py-2 text-[#ededed] focus:outline-none focus:border-[#666666]"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#888888] mb-1">Slug Identifier</label>
                <input 
                  type="text"
                  placeholder="e.g. bis-edu"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  className="w-full bg-[#111111] border border-[#333333] rounded px-3 py-2 text-[#ededed] font-mono focus:outline-none focus:border-[#666666]"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#888888] mb-1">Domain</label>
                <input 
                  type="text"
                  placeholder="e.g. bis.edu.kg"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="w-full bg-[#111111] border border-[#333333] rounded px-3 py-2 text-[#ededed] font-mono focus:outline-none focus:border-[#666666]"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 font-medium">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[#111111] hover:bg-[#222222] text-[#888888] rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#ffffff] text-[#000000] font-semibold hover:bg-[#ccc] rounded"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
