import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Copy, KeyRound, Mail } from "lucide-react";
import { Button, Modal, input, toast } from "../../../components/ui";
import { errText, post } from "./api";

type Mode = "email" | "set";

/**
 * Сброс пароля сотрудника: ссылка на его почту или пароль, который задаёт
 * администратор (свой или созданный системой). Возвращает true, если пароль
 * сменён или письмо ушло.
 */
function ResetPasswordModal({ url, who, onDone }: { url: string; who: string; onDone: (ok: boolean) => void }) {
  const [mode, setMode] = useState<Mode>("email");
  const [own, setOwn] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  const submit = async () => {
    if (mode === "set" && own && password.length < 8) { toast.error("Пароль — от 8 символов"); return; }
    setBusy(true);
    try {
      const r = await post<{ sentTo?: string; password?: string }>(`${url}/reset-password`, mode === "email" ? { mode } : { mode, ...(own ? { password } : {}) });
      if (mode === "email") { toast.success(`Письмо отправлено: ${r.sentTo}`); onDone(true); return; }
      if (r.password) { setIssued(r.password); return; }
      toast.success("Пароль изменён, сеансы сотрудника завершены");
      onDone(true);
    } catch (e) { toast.error(errText(e)); }
    finally { setBusy(false); }
  };

  const copy = async (v: string) => {
    try { await navigator.clipboard.writeText(v); toast.success("Скопировано"); } catch { toast.error("Не удалось скопировать"); }
  };

  if (issued) {
    return (
      <Modal title={`Новый пароль: ${who}`} onClose={() => onDone(true)}>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-hover)] px-3 py-2 font-mono text-base tracking-wide text-[var(--text-main)] select-all">{issued}</code>
            <Button icon={<Copy className="h-4 w-4" />} onClick={() => void copy(issued)}>Копировать</Button>
          </div>
          <div className="text-sm text-[var(--text-muted)]">Показывается один раз.</div>
          <div className="flex justify-end"><Button variant="primary" onClick={() => onDone(true)}>Готово</Button></div>
        </div>
      </Modal>
    );
  }

  const opt = (m: Mode, icon: React.ReactNode, title: string) => (
    <button type="button" onClick={() => setMode(m)}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition ${mode === m ? "border-[var(--accent)] bg-[var(--bg-surface-hover)]" : "border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]"}`}>
      {icon}<span className="font-medium text-[var(--text-main)]">{title}</span>
    </button>
  );

  return (
    <Modal title={`Сбросить пароль: ${who}`} onClose={() => onDone(false)}>
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {opt("email", <Mail className="h-5 w-5 text-[var(--accent)]" />, "Ссылка на почту сотрудника")}
          {opt("set", <KeyRound className="h-5 w-5 text-[var(--accent)]" />, "Задать пароль самому")}
        </div>
        {mode === "set" && (
          <div className="space-y-2">
            <div className="inline-flex rounded-lg border border-[var(--border-color)] p-0.5 text-sm">
              {([[false, "Создать автоматически"], [true, "Ввести свой"]] as const).map(([v, l]) => (
                <button key={String(v)} type="button" onClick={() => setOwn(v)}
                  className={`rounded-md px-3 py-1.5 font-medium transition ${own === v ? "bg-[var(--accent)] text-white" : "text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"}`}>{l}</button>
              ))}
            </div>
            {own && <input className={input} type="text" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Не короче 8 символов" />}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={() => onDone(false)} disabled={busy}>Отмена</Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>{mode === "email" ? "Отправить письмо" : "Сменить пароль"}</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Открыть окно вне дерева страницы; промис — итог. */
export function openResetPassword(url: string, who: string): Promise<boolean> {
  return new Promise(resolve => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (ok: boolean) => { root.unmount(); host.remove(); resolve(ok); };
    root.render(<ResetPasswordModal url={url} who={who} onDone={done} />);
  });
}
