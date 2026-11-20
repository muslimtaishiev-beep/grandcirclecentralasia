import { confirmDialog, toast } from "../../../components/ui";
import { del, errText, post, type StaffRow } from "./api";

export type StaffActionKind = "suspend" | "resume" | "sessions" | "password" | "remove" | "resend" | "revoke";

type Who = Pick<StaffRow, "uid" | "name" | "status">;

/** Действие над сотрудником с подтверждением. true — выполнено и список надо обновить. */
export async function runStaffAction(tenantId: string, kind: StaffActionKind, s: Who): Promise<boolean> {
  const url = `/api/tenants/${tenantId}/staff/${encodeURIComponent(s.uid)}`;
  const who = s.name || "сотрудник";
  try {
    switch (kind) {
      case "suspend":
        if (!(await confirmDialog({ title: `Отключить: ${who}`, message: "Доступ закроется, все сеансы завершатся.", confirmLabel: "Отключить", danger: true }))) return false;
        await post(`${url}/suspend`);
        toast.success("Сотрудник отключён");
        return true;
      case "resume":
        await post(`${url}/resume`);
        toast.success("Сотрудник включён");
        return true;
      case "sessions":
        if (!(await confirmDialog({ title: `Выйти везде: ${who}`, message: "Сотрудник выйдет на всех устройствах.", confirmLabel: "Завершить сеансы" }))) return false;
        await post(`${url}/revoke-sessions`);
        toast.success("Сеансы завершены");
        return true;
      case "password": {
        if (!(await confirmDialog({ title: `Сбросить пароль: ${who}`, message: "Сотруднику уйдёт письмо для смены пароля.", confirmLabel: "Отправить письмо" }))) return false;
        const r = await post<{ sentTo: string }>(`${url}/reset-password`);
        toast.success(`Письмо отправлено: ${r.sentTo}`);
        return true;
      }
      case "remove":
        if (!(await confirmDialog({ title: `Удалить из организации: ${who}`, message: "Учётная запись останется, доступ к организации пропадёт.", confirmLabel: "Удалить", danger: true }))) return false;
        await del(url);
        toast.success("Сотрудник удалён из организации");
        return true;
      case "resend": {
        const r = await post<{ sentTo: string }>(`${url}/resend-invite`);
        toast.success(`Приглашение отправлено: ${r.sentTo}`);
        return true;
      }
      case "revoke":
        if (!(await confirmDialog({ title: `Отозвать приглашение: ${who}`, confirmLabel: "Отозвать", danger: true }))) return false;
        await post(`${url}/revoke-invite`);
        toast.success("Приглашение отозвано");
        return true;
    }
  } catch (e) {
    toast.error(errText(e));
    return false;
  }
}

/** Пункты меню «…» по статусу сотрудника. */
export function staffMenu(s: Who & { systemRole: StaffRow["systemRole"] }, canManage: boolean, isSelf: boolean, run: (k: StaffActionKind) => void) {
  const off = !canManage || isSelf;
  return [
    { label: "Отключить", onClick: () => run("suspend"), hidden: off || s.status === "suspended" || s.status === "invited" },
    { label: "Включить", onClick: () => run("resume"), hidden: off || s.status !== "suspended" },
    { label: "Выйти везде", onClick: () => run("sessions"), hidden: off || s.status === "invited" },
    { label: "Сбросить пароль", onClick: () => run("password"), hidden: off || s.status === "invited" },
    { label: "Повторить приглашение", onClick: () => run("resend"), hidden: off || s.status !== "invited" },
    { label: "Отозвать приглашение", onClick: () => run("revoke"), hidden: off || s.status !== "invited", danger: true },
    { label: "Удалить из организации", onClick: () => run("remove"), hidden: off || s.status === "invited" || s.systemRole === "owner", danger: true },
  ];
}
