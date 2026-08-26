import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Must be a domain verified in the Resend dashboard, or the shared Resend
// sandbox sender ("onboarding@resend.dev") while a custom domain isn't set up yet.
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailShell(tenantName: string, bodyHtml: string): string {
  const safeName = escapeHtml(tenantName || "Образовательная платформа");
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.2px;">${safeName}</span>
          </td>
        </tr>
        <tr><td style="padding:32px;">${bodyHtml}</td></tr>
        <tr>
          <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">
              Это автоматическое письмо, отвечать на него не нужно. Если вы считаете, что получили его по ошибке — просто проигнорируйте.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

interface TestResultEmailParams {
  to: string;
  studentName: string;
  tenantName: string;
  grade: number;
  scores: { russian?: number; math?: number; logic?: number; english?: number; total?: number };
  maxScoreSnapshot?: number;
  shortId: string;
}

export async function sendTestResultEmail(params: TestResultEmailParams): Promise<{ sent: boolean; reason?: string }> {
  if (!resend) return { sent: false, reason: "RESEND_API_KEY not configured" };
  if (!params.to || !params.to.includes("@")) return { sent: false, reason: "Invalid recipient email" };

  const { studentName, tenantName, grade, scores, maxScoreSnapshot, shortId } = params;
  const total = scores.total ?? 0;
  const percent = maxScoreSnapshot ? Math.round((total / maxScoreSnapshot) * 100) : null;

  const rows = [
    ["Русский язык", scores.russian],
    ["Математика", scores.math],
    ["Логика", scores.logic],
    ["Английский язык", scores.english],
  ].filter(([, v]) => v !== undefined && v !== null);

  const rowsHtml = rows.map(([label, val]) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#475569;font-size:14px;">${escapeHtml(String(label))}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(String(val))}</td>
    </tr>`).join("");

  const body = `
    <p style="margin:0 0 4px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;">Результаты тестирования</p>
    <h1 style="margin:0 0 20px;font-size:22px;color:#0f172a;">Здравствуйте, ${escapeHtml(studentName)}!</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#475569;">
      Вы успешно завершили вступительное тестирование (${escapeHtml(String(grade))} класс). Ниже — ваши результаты по предметам.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${rowsHtml}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2ff;border-radius:12px;">
      <tr>
        <td style="padding:18px 20px;">
          <div style="font-size:13px;color:#4338ca;font-weight:600;">Общий балл</div>
          <div style="font-size:28px;color:#1e1b4b;font-weight:800;margin-top:2px;">
            ${total}${maxScoreSnapshot ? ` из ${maxScoreSnapshot}` : ""}
            ${percent !== null ? `<span style="font-size:15px;color:#4338ca;font-weight:600;"> (${percent}%)</span>` : ""}
          </div>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;font-size:13px;line-height:20px;color:#94a3b8;">
      Ваш номер участника: <strong style="color:#475569;">${escapeHtml(shortId)}</strong>. Сохраните его — он понадобится при обращении в приёмную комиссию.
    </p>`;

  try {
    const result = await resend.emails.send({
      from: `${tenantName || "Приёмная комиссия"} <${FROM_ADDRESS}>`,
      to: params.to,
      subject: `Результаты вступительного тестирования — ${studentName}`,
      html: emailShell(tenantName, body),
    });
    if ((result as any)?.error) return { sent: false, reason: (result as any).error.message };
    return { sent: true };
  } catch (e: any) {
    return { sent: false, reason: e?.message || "Unknown Resend error" };
  }
}

interface StaffInviteEmailParams {
  to: string;
  fullName: string;
  tenantName: string;
  role: string;
  resetLink: string;
}

export async function sendStaffInviteEmail(params: StaffInviteEmailParams): Promise<{ sent: boolean; reason?: string }> {
  if (!resend) return { sent: false, reason: "RESEND_API_KEY not configured" };
  if (!params.to || !params.to.includes("@")) return { sent: false, reason: "Invalid recipient email" };

  const { fullName, tenantName, role, resetLink } = params;

  const body = `
    <p style="margin:0 0 4px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;">Приглашение в команду</p>
    <h1 style="margin:0 0 20px;font-size:22px;color:#0f172a;">Здравствуйте, ${escapeHtml(fullName)}!</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#475569;">
      Вас пригласили присоединиться к рабочему пространству
      «<strong style="color:#0f172a;">${escapeHtml(tenantName)}</strong>» в роли
      <strong style="color:#0f172a;">${escapeHtml(role)}</strong>.
    </p>
    <p style="margin:0 0 28px;font-size:14px;line-height:22px;color:#475569;">
      Чтобы начать работу, задайте пароль для вашего аккаунта по кнопке ниже.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-radius:10px;background:linear-gradient(135deg,#4f46e5,#7c3aed);">
          <a href="${escapeHtml(resetLink)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
            Установить пароль и войти
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#94a3b8;">
      Если кнопка не работает, скопируйте эту ссылку в браузер:<br>
      <span style="word-break:break-all;color:#64748b;">${escapeHtml(resetLink)}</span>
    </p>`;

  try {
    const result = await resend.emails.send({
      from: `${tenantName || "Академия"} <${FROM_ADDRESS}>`,
      to: params.to,
      subject: `Приглашение в «${tenantName}»`,
      html: emailShell(tenantName, body),
    });
    if ((result as any)?.error) return { sent: false, reason: (result as any).error.message };
    return { sent: true };
  } catch (e: any) {
    return { sent: false, reason: e?.message || "Unknown Resend error" };
  }
}
