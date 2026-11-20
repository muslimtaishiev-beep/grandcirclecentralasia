import React, { useCallback, useEffect, useRef, useState } from "react";
import hotToast, { Toaster } from "react-hot-toast";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./journalKit";
import { Button } from "./kit";

/**
 * Подтверждения и уведомления вместо alert/confirm/prompt.
 * confirmDialog() и toast — модульные: работают и вне компонентов,
 * если в дереве смонтирован <UiFeedbackProvider/>.
 */

// ── Уведомления ──────────────────────────────────────────────────────────
type Msg = string | React.ReactNode;
export const toast = Object.assign((m: Msg) => hotToast(m as any), {
  success: (m: Msg) => hotToast.success(m as any),
  error: (m: Msg) => hotToast.error(m as any, { duration: 6000 }),
  loading: (m: Msg) => hotToast.loading(m as any),
  dismiss: (id?: string) => hotToast.dismiss(id),
  promise: hotToast.promise,
});

export function AppToaster() {
  return (
    <Toaster position="top-right" gutter={8} toastOptions={{
      duration: 3500,
      style: { background: "var(--bg-surface)", color: "var(--text-main)", border: "1px solid var(--border-color)", fontSize: 14, borderRadius: 12, maxWidth: 420 },
    }} />
  );
}

// ── Подтверждение ────────────────────────────────────────────────────────
export interface ConfirmOptions {
  title: string;
  /** Что именно произойдёт — одна строка, без пояснений «зачем». */
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let open: ((o: Pending) => void) | null = null;

/** Promise<boolean>: true — подтвердили. Без провайдера — отказ, ничего не удаляется молча. */
export function confirmDialog(o: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof o === "string" ? { title: o } : o;
  return new Promise(resolve => {
    if (!open) { console.warn("[confirmDialog] провайдер не смонтирован"); resolve(false); return; }
    open({ ...opts, resolve });
  });
}

export function useConfirm() {
  return useCallback((o: ConfirmOptions | string) => confirmDialog(o), []);
}

function ConfirmHost() {
  const [cur, setCur] = useState<Pending | null>(null);
  const queue = useRef<Pending[]>([]);
  useEffect(() => {
    open = p => setCur(c => { if (c) { queue.current.push(p); return c; } return p; });
    return () => { open = null; };
  }, []);
  const done = (ok: boolean) => {
    cur?.resolve(ok);
    setCur(queue.current.shift() || null);
  };
  if (!cur) return null;
  return (
    <Modal title={cur.title} onClose={() => done(false)}>
      <div className="space-y-5">
        {cur.message && (
          <div className="flex gap-3 text-sm text-[var(--text-main)]">
            {cur.danger && <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />}
            <div className="min-w-0">{cur.message}</div>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => done(false)}>{cur.cancelLabel || "Отмена"}</Button>
          <Button variant={cur.danger ? "danger" : "primary"} autoFocus onClick={() => done(true)}>{cur.confirmLabel || (cur.danger ? "Удалить" : "Подтвердить")}</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Один на приложение: окна подтверждения и уведомления. */
export function UiFeedbackProvider({ children }: { children?: React.ReactNode }) {
  return (
    <>
      {children}
      <ConfirmHost />
      <AppToaster />
    </>
  );
}
export const ConfirmProvider = UiFeedbackProvider;
