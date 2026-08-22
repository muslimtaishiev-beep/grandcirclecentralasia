import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Plus, Trash2, Mail, Shield, User, Users, Loader2, CheckSquare, FileText, Award, Table, MessageSquare, Briefcase } from "lucide-react";
import { createNotification } from "../../lib/useNotifications";

export default function WorkspaceSettings() {
  const { activeTenant } = useOutletContext<any>() || {};
  const { user } = useAuth();
  
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Работник");
  const [isInviting, setIsInviting] = useState(false);

  // Bitrix24 Permission States per member (stored locally & synced)
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    if (activeTenant) {
      fetchMembers();
    }
  }, [activeTenant]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tenants/${activeTenant.id}/members`, {
        headers: {
          "Authorization": `Bearer ${await user?.getIdToken()}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setMembers(data.members || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberPermission = (memberId: string, permKey: string) => {
    setPermissions(prev => {
      const memberPerms = prev[memberId] || {
        contracts: true,
        certificates: true,
        crm: true,
        tasks: true,
        docs: true,
        sheets: true
      };
      return {
        ...prev,
        [memberId]: {
          ...memberPerms,
          [permKey]: !memberPerms[permKey]
        }
      };
    });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      const res = await fetch(`/api/tenants/${activeTenant.id}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await user?.getIdToken()}`
        },
        body: JSON.stringify({ email: inviteEmail, name: inviteName, roleName: inviteRole, role: inviteRole })
      });
      const data = await res.json();
      if (data.success) {
        setInviteEmail("");
        setInviteName("");
        fetchMembers();
        await createNotification({
          tenantId: activeTenant.id,
          userId: user.uid,
          title: "Сотрудник Добавлен",
          body: `Сотрудник ${inviteName || inviteEmail} добавлен с ролью "${inviteRole}".`,
          type: "system"
        });
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("Не удалось добавить сотрудника");
    } finally {
      setIsInviting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'org:admin': case 'Управляющий': return <span className="px-2.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-md text-xs font-bold flex items-center gap-1"><Shield className="w-3 h-3" /> Управляющий</span>;
      case 'Работник': default: return <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-md text-xs font-bold flex items-center gap-1"><User className="w-3 h-3" /> {role || "Работник"}</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 text-[var(--text-main)]">
      <div>
        <h1 className="text-2xl font-bold">Управление Командой и Правами Доступа (Bitrix24 Style)</h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">Регистрация сотрудников и делегирование индивидуальных прав доступа для {activeTenant?.name}. Каждому работнику выдается личный аккаунт без ручного выбора менеджеров.</p>
      </div>

      {/* Invite Form */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Plus className="w-5 h-5 text-[var(--accent)]" /> Регистрация Нового Сотрудника Управляющим
        </h2>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text"
              placeholder="ФИО / Имя сотрудника (напр. Иван Иванов)..."
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-main)]"
            />
          </div>
          <div className="flex-1 relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="email"
              placeholder="Email нового сотрудника..."
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-main)]"
            />
          </div>
          <div className="w-48 relative">
            <Briefcase className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text"
              placeholder="Роль (напр. Работник, Проктор)..."
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-main)] font-semibold"
            />
          </div>
          <button 
            type="submit" 
            disabled={isInviting || !inviteEmail}
            className="bg-[var(--accent)] text-white px-6 py-2 rounded-xl font-bold text-xs hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center min-w-[140px] cursor-pointer"
          >
            {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Выдать Аккаунт"}
          </button>
        </form>
      </div>

      {/* Staff Members List & Permission Delegation */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-xs overflow-hidden">
        <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-panel)]">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-[var(--accent)]" />
              Список Работников и Права Доступов
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Личные кабинеты работников и разрешения на разделы платформы</p>
          </div>
          <span className="text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-app)] px-3 py-1 rounded-full border border-[var(--border-color)] font-mono">
            Штат: {members.length}
          </span>
        </div>
        
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-[var(--text-muted)] text-xs">
            В вашей организации пока нет зарегистрированных сотрудников.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {members.map(member => {
              const memberPerms = permissions[member.id] || {
                contracts: true,
                certificates: true,
                crm: true,
                tasks: true,
                docs: true,
                sheets: true
              };

              return (
                <div key={member.id} className="p-5 space-y-4 hover:bg-black/5 dark:hover:bg-white/5 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold text-sm shadow-xs">
                        {(member.displayName || member.user?.displayName || member.user?.email || "С")?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[var(--text-main)]">
                          {member.displayName || member.user?.displayName || member.name || member.user?.email || "Сотрудник компании"}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] font-mono">{member.user?.email || member.email || ""}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {getRoleBadge(member.role)}
                          <span className="text-xs text-[var(--text-muted)]">• Личный аккаунт работника</span>
                        </div>
                      </div>
                    </div>

                    <button className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Bitrix24 Granular Permission Toggles */}
                  <div className="bg-[var(--bg-app)] p-3.5 rounded-xl border border-[var(--border-color)] space-y-2">
                    <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase font-mono">
                      Разрешения и доступы сотрудника (Регулирует Руководитель):
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                      {[
                        { key: 'crm', label: 'CRM Сделки', icon: Briefcase },
                        { key: 'contracts', label: 'Договоры', icon: FileText },
                        { key: 'certificates', label: 'Справки', icon: Award },
                        { key: 'tasks', label: 'Задачки', icon: CheckSquare },
                        { key: 'docs', label: 'Документы', icon: FileText },
                        { key: 'sheets', label: 'Таблицы', icon: Table },
                      ].map(item => {
                        const Icon = item.icon;
                        const isGranted = memberPerms[item.key];
                        return (
                          <button
                            key={item.key}
                            onClick={() => toggleMemberPermission(member.id, item.key)}
                            className={`p-2 rounded-lg border text-[11px] font-medium flex items-center justify-between transition cursor-pointer ${
                              isGranted
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold'
                                : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--text-muted)] line-through'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              {item.label}
                            </span>
                            <span className="text-[10px] font-mono ml-1">{isGranted ? '✓' : '✕'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
