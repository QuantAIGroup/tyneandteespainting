import "server-only";

/**
 * EMAIL NOTIFICATIONS (optional – configure later)
 *
 * Sends you an email when a new enquiry or contact message arrives, using
 * Resend (https://resend.com – free tier available). To switch it on, set:
 *   RESEND_API_KEY=re_...
 *   NOTIFICATION_EMAIL_TO=you@yourdomain.co.uk
 *   NOTIFICATION_EMAIL_FROM="Website <enquiries@yourdomain.co.uk>"  (a domain verified in Resend)
 *
 * If these aren't set, nothing is sent and enquiries are still saved safely –
 * you'll see them in /admin either way. A failed email never loses an enquiry.
 */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL_TO && process.env.NOTIFICATION_EMAIL_FROM);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Email YOU (the business) – new enquiries, payments received, problems. */
export async function sendNotification(subject: string, lines: string[]): Promise<{ sent: boolean; reason?: string }> {
  if (!isEmailConfigured()) {
    console.info(`[notifications] Email not configured – skipped: ${subject}`);
    return { sent: false, reason: "not_configured" };
  }
  return sendEmail(process.env.NOTIFICATION_EMAIL_TO!.split(",").map((s) => s.trim()), subject, lines);
}

/** Email a CUSTOMER – payment links and deposit confirmations. Replies go to your NOTIFICATION_EMAIL_TO address. */
export async function sendCustomerEmail(
  to: string,
  subject: string,
  lines: string[],
  button?: { label: string; url: string },
): Promise<{ sent: boolean; reason?: string }> {
  if (!isEmailConfigured()) {
    console.info(`[notifications] Email not configured – customer email skipped: ${subject}`);
    return { sent: false, reason: "not_configured" };
  }
  const replyTo = process.env.NOTIFICATION_EMAIL_TO!.split(",")[0].trim();
  return sendEmail([to], subject, lines, button, replyTo);
}

/** Email a PAINTER – job offers, onboarding decisions, sign-in links. Replies go to your NOTIFICATION_EMAIL_TO address. */
export async function sendPainterEmail(
  to: string,
  subject: string,
  lines: string[],
  button?: { label: string; url: string },
): Promise<{ sent: boolean; reason?: string }> {
  if (!isEmailConfigured()) {
    console.info(`[notifications] Email not configured – painter email skipped: ${subject}`);
    return { sent: false, reason: "not_configured" };
  }
  const replyTo = process.env.NOTIFICATION_EMAIL_TO!.split(",")[0].trim();
  return sendEmail([to], subject, lines, button, replyTo);
}

async function sendEmail(
  to: string[],
  subject: string,
  lines: string[],
  button?: { label: string; url: string },
  replyTo?: string,
): Promise<{ sent: boolean; reason?: string }> {
  const buttonHtml = button
    ? `<p style="margin:20px 0"><a href="${escapeHtml(button.url)}" style="background:#0012DA;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">${escapeHtml(button.label)}</a></p>`
    : "";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFICATION_EMAIL_FROM,
        to,
        reply_to: replyTo,
        subject,
        text: [...lines, ...(button ? ["", `${button.label}: ${button.url}`] : [])].join("\n"),
        html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#111">${lines.map((l) => `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`).join("")}${buttonHtml}</div>`,
      }),
    });
    if (!res.ok) {
      console.error(`[notifications] Resend error ${res.status}: ${await res.text()}`);
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[notifications] Failed to send email", err);
    return { sent: false, reason: "network_error" };
  }
}
