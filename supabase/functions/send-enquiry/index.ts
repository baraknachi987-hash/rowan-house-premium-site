import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 4;
const requestTimes = new Map<string, number[]>();

function json(data: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Vary": "Origin",
      ...(origin ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Max-Age": "86400",
      } : {}),
    },
  });
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (char) => entities[char]);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function trimText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (requestTimes.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) return true;
  recent.push(now);
  requestTimes.set(ip, recent);
  return false;
}

function emailHtml(data: {
  name: string; email: string; checkin: string; checkout: string;
  guests: string; room: string; message: string; sourcePage: string;
}) {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:13px 0;color:#9aa59b;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;border-bottom:1px solid #29352d;width:35%;">${label}</td>
      <td style="padding:13px 0;color:#f4f1e9;font-size:14px;line-height:1.5;border-bottom:1px solid #29352d;">${value || "—"}</td>
    </tr>`;
  return `<!doctype html><html><body style="margin:0;padding:28px 12px;background:#101713;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:620px;margin:0 auto;background:#17211b;border:1px solid #364137;border-radius:16px;overflow:hidden;">
      <div style="padding:28px 30px;background:linear-gradient(135deg,#202d24,#121a15);border-bottom:1px solid #3b493d;">
        <p style="margin:0 0 10px;color:#c5a16c;font-size:10px;letter-spacing:3px;text-transform:uppercase;">THE ROWAN HOUSE · RESERVATIONS</p>
        <h1 style="margin:0;color:#f4f1e9;font-family:Georgia,serif;font-size:29px;font-weight:400;">A new enquiry has arrived.</h1>
        <p style="margin:12px 0 0;color:#b8c0b8;font-size:13px;line-height:1.6;">A guest has submitted a stay enquiry from your website. Reply directly to this email to contact them.</p>
      </div>
      <div style="padding:22px 30px 28px;">
        <div style="display:inline-block;margin-bottom:18px;padding:8px 11px;border:1px solid #806b4d;border-radius:999px;color:#e0c69d;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;">New website enquiry</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          ${row("Guest", escapeHtml(data.name))}
          ${row("Email", `<a href="mailto:${escapeHtml(data.email)}" style="color:#dfc49a;text-decoration:none;">${escapeHtml(data.email)}</a>`)}
          ${row("Check-in", escapeHtml(data.checkin))}
          ${row("Check-out", escapeHtml(data.checkout))}
          ${row("Guests", escapeHtml(data.guests))}
          ${row("Room preference", escapeHtml(data.room))}
          ${row("Sent from", escapeHtml(data.sourcePage))}
        </table>
        <div style="margin-top:22px;padding:18px 20px;background:#202c24;border:1px solid #344238;border-radius:11px;">
          <p style="margin:0 0 9px;color:#c5a16c;font-size:10px;letter-spacing:1.7px;text-transform:uppercase;">Guest message</p>
          <p style="margin:0;color:#f4f1e9;font-size:14px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(data.message || "No additional message provided.")}</p>
        </div>
        <p style="margin:22px 0 0;color:#9aa59b;font-size:11px;line-height:1.6;">This is an enquiry only. Availability, rates and booking status have not been confirmed.</p>
      </div>
    </div>
  </body></html>`;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const defaultOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://baraknachi987-hash.github.io",
  ];
  const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

  if (!origin || !allowedOrigins.has(origin)) {
    return json({ ok: false, error: "This website origin is not allowed. Use Live Server on port 5500 or the configured GitHub Pages site." }, 403, "");
  }
  if (req.method === "OPTIONS") return json({ ok: true }, 200, origin);
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405, origin);

  const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  if (rateLimited(ip)) return json({ ok: false, error: "Too many enquiries. Please try again later." }, 429, origin);

  let body: Record<string, unknown>;
  try {
    const rawBody = await req.text();
    if (rawBody.length > 12000) return json({ ok: false, error: "Request is too large." }, 413, origin);
    body = JSON.parse(rawBody);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid payload");
  } catch {
    return json({ ok: false, error: "Invalid request format." }, 400, origin);
  }

  // Quietly accept the request if the hidden bot-trap field was filled.
  if (trimText(body.website, 200)) return json({ ok: true }, 200, origin);

  const name = trimText(body.name, 100);
  const email = trimText(body.email, 254);
  const checkin = body.checkin;
  const checkout = body.checkout;
  const guests = trimText(body.guests, 30);
  const room = trimText(body.room, 100) || "Not specified";
  const message = trimText(body.message, 2000);
  const sourcePage = trimText(body.source_page, 200) || "Website enquiry form";

  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "Enter a valid name and email address." }, 400, origin);
  }
  if (!validDate(checkin) || !validDate(checkout) || checkout <= checkin) {
    return json({ ok: false, error: "Choose valid dates, with check-out after check-in." }, 400, origin);
  }
  if (!["1 guest", "2 guests", "3 guests", "4 guests", "5+ guests"].includes(guests)) {
    return json({ ok: false, error: "Choose a valid guest count." }, 400, origin);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const recipient = "baraknachi987@gmail.com";
  const from = "The Rowan House <onboarding@resend.dev>";
  if (!apiKey) {
    console.error("RESEND_API_KEY is not configured.");
    return json({ ok: false, error: "The Resend API key is missing from Supabase Function Secrets." }, 503, origin);
  }

  const emailData = { name, email, checkin, checkout, guests, room, message, sourcePage };
  const textBody = [
    "THE ROWAN HOUSE — NEW WEBSITE ENQUIRY",
    `Guest: ${name}`, `Email: ${email}`, `Check-in: ${checkin}`, `Check-out: ${checkout}`,
    `Guests: ${guests}`, `Room preference: ${room}`, `Sent from: ${sourcePage}`,
    "", "Guest message:", message || "No additional message provided.",
    "", "Enquiry only — no booking has been confirmed."
  ].join("\n");

  try {
    const mailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        reply_to: email,
        subject: `New stay enquiry — ${name.replace(/[\r\n]/g, " ").slice(0, 80)}`,
        html: emailHtml(emailData),
        text: textBody,
      }),
    });

    const providerResult = await mailResponse.json().catch(() => ({}));
    if (!mailResponse.ok) {
      console.error("Resend rejected the enquiry. HTTP status:", mailResponse.status, "name:", providerResult?.name || "unknown");
      if (mailResponse.status === 403) {
        return json({
          ok: false,
          error: "Resend's test sender only delivers to the email address registered on your Resend account. Confirm that your Resend account uses baraknachi987@gmail.com. Sending to other addresses requires a verified domain.",
        }, 502, origin);
      }
      if (mailResponse.status === 401) {
        return json({ ok: false, error: "Resend rejected the API key. Check that the correct RESEND_API_KEY is saved in Supabase Function Secrets." }, 502, origin);
      }
      return json({ ok: false, error: "Resend did not accept the email. Check the Resend dashboard Email Logs for details." }, 502, origin);
    }
    return json({ ok: true, emailId: providerResult.id || null }, 200, origin);
  } catch (error) {
    console.error("Email delivery request failed:", error instanceof Error ? error.name : "UnknownError");
    return json({ ok: false, error: "A connection error prevented delivery. Please try again." }, 502, origin);
  }
});
