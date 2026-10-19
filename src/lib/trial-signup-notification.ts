// Notifies the Performers Ready team by email (via Resend) when a teacher
// signs up for a free trial. Failures are logged, never thrown, so a Resend
// outage can't break signup.

export const TRIAL_SIGNUP_RECIPIENTS = [
  "emili@betterhumanseducation.com",
  "ronpassaro@gmail.com",
];

const DEFAULT_FROM = "Performers Ready <notifications@performersready.com>";

export interface TrialSignupDetails {
  first_name: string;
  last_name: string;
  email: string;
  primary_discipline?: string | null;
  california?: boolean | null;
  district_name?: string | null;
  trial_ends_at?: string | null;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDiscipline = (d?: string | null) => {
  if (!d || d === "N/A") return "N/A";
  return d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
};

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });
};

export function buildTrialSignupEmail(details: TrialSignupDetails) {
  const name = `${details.first_name} ${details.last_name}`.trim();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://performersready.com").replace(/\/$/, "");

  const rows: [string, string][] = [
    ["Name", name],
    ["Email", details.email],
    ["Primary discipline", formatDiscipline(details.primary_discipline)],
    ["California", details.california === false ? "No" : "Yes"],
    ["District", details.district_name || "—"],
    ["Signed up", formatDate(new Date().toISOString())],
    ["Trial ends", formatDate(details.trial_ends_at)],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 16px 8px 0;color:#666666;font-size:14px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;color:#1a1a1a;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:Montserrat,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;">
      <tr>
        <td style="padding:28px 32px 8px;">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#666666;">Performers Ready!</div>
          <h1 style="margin:8px 0 4px;font-size:20px;color:#1a1a1a;">New trial signup</h1>
          <p style="margin:0;font-size:14px;color:#666666;">${escapeHtml(name)} just started a 14-day free trial.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0">${rowsHtml}</table>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 28px;">
          <a href="${appUrl}/admin/teachers" style="display:inline-block;padding:10px 18px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">View in admin</a>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `New trial signup: ${name} just started a 14-day free trial.`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    `View in admin: ${appUrl}/admin/teachers`,
  ].join("\n");

  return { subject: `New trial signup: ${name}`, html, text };
}

export async function sendTrialSignupNotification(
  details: TrialSignupDetails,
  recipients: string[] = TRIAL_SIGNUP_RECIPIENTS
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[trial-signup-notification] RESEND_API_KEY not set; skipping email");
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const { subject, html, text } = buildTrialSignupEmail(details);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
        to: recipients,
        reply_to: details.email,
        subject,
        html,
        text,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[trial-signup-notification] Resend error", res.status, data);
      return { ok: false, error: data?.message || `HTTP ${res.status}` };
    }
    return { ok: true, id: data?.id };
  } catch (error: any) {
    console.error("[trial-signup-notification] failed", error);
    return { ok: false, error: error?.message || String(error) };
  }
}
