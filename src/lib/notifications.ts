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

export async function sendNotification(subject: string, lines: string[]): Promise<{ sent: boolean; reason?: string }> {
  if (!isEmailConfigured()) {
    console.info(`[notifications] Email not configured – skipped: ${subject}`);
    return { sent: false, reason: "not_configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFICATION_EMAIL_FROM,
        to: process.env.NOTIFICATION_EMAIL_TO!.split(",").map((s) => s.trim()),
        subject,
        text: lines.join("\n"),
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${lines.map((l) => `<p style="margin:0 0 6px">${escapeHtml(l)}</p>`).join("")}</div>`,
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
