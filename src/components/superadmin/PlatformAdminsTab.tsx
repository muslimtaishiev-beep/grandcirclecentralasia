import React, { useEffect, useState, useCallback } from "react";
import { auth } from "../../lib/firebase";
import { Button, Spinner, EmptyState, confirmDialog, toast } from "../ui";

interface PlatformAdmin { uid: string; email: string; name: string; self: boolean }

async function headers(): Promise<Record<string, string>> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

/** Администраторы платформы: список и снятие прав (себя снять нельзя). */
export function PlatformAdminsTab() {
  const [admins, setAdmins] = useState<PlatformAdmin[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/superadmin/admins", { headers: await headers() });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || "Не удалось загрузить список");
      setAdmins(j.admins as PlatformAdmin[]);
    } catch (e: any) {
      toast.error(e?.message || "Не удалось загрузить список");
      setAdmins([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const revoke = async (a: PlatformAdmin) => {
    const ok = await confirmDialog({ title: `Снять права суперадмина: ${a.email || a.uid}?`, confirmLabel: "Снять", danger: true });
    if (!ok) return;
    setBusy(a.uid);
    try {
      const r = await fetch(`/api/superadmin/admins/${encodeURIComponent(a.uid)}`, { method: "DELETE", headers: await headers() });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || "Не удалось снять права");
      toast.success("Права сняты");
      setAdmins(prev => (prev || []).filter(x => x.uid !== a.uid));
    } catch (e: any) {
      toast.error(e?.message || "Не удалось снять права");
    } finally {
      setBusy(null);
    }
  };

  if (!admins) return <div className="p-6 flex justify-center"><Spinner /></div>;
  if (admins.length === 0) return <EmptyState title="Список пуст" />;
  return (
    <div className="bg-[#0a0a0a] border border-[#333333] rounded-lg divide-y divide-[#222222]">
      {admins.map(a => (
        <div key={a.uid} className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{a.name || a.email || a.uid}</div>
            <div className="text-xs text-[#888888] truncate">{a.email}{a.self ? " · это вы" : ""}</div>
          </div>
          {!a.self && <Button variant="danger" size="sm" loading={busy === a.uid} onClick={() => revoke(a)}>Снять</Button>}
        </div>
      ))}
    </div>
  );
}
