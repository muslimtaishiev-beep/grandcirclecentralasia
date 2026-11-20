import { useEffect, useState } from "react";
import { Button, Spinner, confirmDialog, input, toast } from "../../../components/ui";
import { apiCall, errText, post, type StaffRow } from "./api";

/** Передача владения и второй владелец — только владельцу. */
export default function OwnershipPanel({ tenantId, onDone }: { tenantId: string; onDone: () => void }) {
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [uid, setUid] = useState("");
  const [busy, setBusy] = useState<"" | "transfer" | "add">("");

  useEffect(() => {
    apiCall<{ staff: StaffRow[] }>(`/api/tenants/${tenantId}/staff`)
      .then(j => setStaff(j.staff.filter(s => s.status === "active" && s.systemRole !== "owner")))
      .catch(e => { toast.error(errText(e)); setStaff([]); });
  }, [tenantId]);

  const go = async (kind: "transfer" | "add") => {
    const target = staff?.find(s => s.uid === uid);
    if (!target) return;
    const ok = await confirmDialog(kind === "transfer"
      ? { title: `Передать владение: ${target.name}`, message: "Вы станете администратором.", confirmLabel: "Передать", danger: true }
      : { title: `Сделать владельцем: ${target.name}`, confirmLabel: "Добавить" });
    if (!ok) return;
    setBusy(kind);
    try {
      await post(`/api/tenants/${tenantId}/${kind === "transfer" ? "transfer-ownership" : "add-owner"}`, { uid });
      toast.success(kind === "transfer" ? "Владение передано" : "Владелец добавлен");
      setUid(""); onDone();
      if (kind === "transfer") window.location.reload();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(""); }
  };

  if (!staff) return <Spinner />;
  return (
    <div className="flex max-w-xl flex-wrap items-center gap-2">
      <select value={uid} onChange={e => setUid(e.target.value)} aria-label="Сотрудник" className={`${input} min-w-[220px] flex-1`}>
        <option value="">Выберите сотрудника</option>
        {staff.map(s => <option key={s.uid} value={s.uid}>{s.name || s.email}</option>)}
      </select>
      <Button variant="danger" disabled={!uid} loading={busy === "transfer"} onClick={() => void go("transfer")}>Передать владение</Button>
      <Button disabled={!uid} loading={busy === "add"} onClick={() => void go("add")}>Добавить владельца</Button>
    </div>
  );
}
