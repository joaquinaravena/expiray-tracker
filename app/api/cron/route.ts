import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import { Resend } from "resend";
import {
  formatExpiryDate,
  getDaysRemaining,
  type TrackerData,
  type Vencimiento,
} from "@/lib/utils";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function isExpiringWithinThreeDays(expiryDateStr: string): boolean {
  const expiry = new Date(expiryDateStr + "T23:59:59").getTime();
  const limit = Date.now() + THREE_DAYS_MS;
  return expiry <= limit;
}

const LOG_PREFIX = "[cron]";

export async function GET(request: NextRequest) {
  console.log(LOG_PREFIX, "Run started");

  if (process.env.CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error(LOG_PREFIX, "Auth failed: missing or invalid CRON_SECRET");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const toEmail = process.env.TO_EMAIL || "tuemail@gmail.com";
  const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";
  const apiKey = process.env.RESEND_API_KEY;
  const resend = apiKey ? new Resend(apiKey) : null;
  if (!resend) {
    console.warn(LOG_PREFIX, "RESEND_API_KEY not set; emails will be skipped");
  }
  console.log(LOG_PREFIX, "Config:", { toEmail, fromEmail, hasResend: !!resend });

  let tracker: TrackerData;
  try {
    const path = process.cwd() + "/public/data/tracker.json";
    const raw = await fs.readFile(path, "utf-8");
    tracker = JSON.parse(raw) as TrackerData;
    if (!tracker?.vencimientos) {
      console.warn(LOG_PREFIX, "tracker.json missing vencimientos, using []");
      tracker = { vencimientos: [], vencidos: [], fallados: [] };
    }
    if (!Array.isArray(tracker.vencimientos)) {
      tracker.vencimientos = [];
    }
    console.log(LOG_PREFIX, "Loaded vencimientos:", tracker.vencimientos.length);
  } catch (err) {
    console.error(LOG_PREFIX, "Failed to read/parse tracker.json:", err);
    return Response.json(
      { error: "Failed to read tracker.json" },
      { status: 500 },
    );
  }

  const toAlert = tracker.vencimientos.filter(
    (p: Vencimiento) => p.vencimiento && isExpiringWithinThreeDays(p.vencimiento),
  );
  if (toAlert.length === 0) {
    console.log(LOG_PREFIX, "No products expiring within 3 days; nothing to send");
    return Response.json({ sent: 0, total: 0 });
  }
  console.log(
    LOG_PREFIX,
    "Products to alert:",
    toAlert.length,
    toAlert.map((p) => `${p.producto} (${p.categoria})`),
  );

  let sent = 0;
  for (const p of toAlert) {
    const days = getDaysRemaining(p.vencimiento);
    const formattedDate = formatExpiryDate(p.vencimiento);
    const subject = `Alerta: ${p.producto} vence ${formattedDate}, días: ${days}`;
    const html = `Producto <strong>${p.producto}</strong>${p.categoria ? ` (${p.categoria})` : ""} vence el <strong>${formattedDate}</strong> en <strong>${days}</strong> días.`;

    try {
      if (!resend) {
        console.warn(LOG_PREFIX, "Skip email (no API key):", p.producto);
        sent++;
        continue;
      }
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [toEmail],
        subject,
        html,
      });
      if (error) {
        console.error(LOG_PREFIX, "Resend error for", p.producto, error);
      } else {
        console.log(LOG_PREFIX, "Email sent:", p.producto, p.categoria, "id:", data?.id);
        sent++;
      }
    } catch (err) {
      console.error(LOG_PREFIX, "Send exception for", p.producto, err);
    }
  }

  console.log(LOG_PREFIX, "Finished. Sent:", sent, "of", toAlert.length);
  return Response.json({ sent, total: toAlert.length });
}
