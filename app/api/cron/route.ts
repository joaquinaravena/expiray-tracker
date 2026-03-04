import { NextRequest } from "next/server";
import { Resend } from "resend";
import webpush from "web-push";
import { formatExpiryDate, getDaysRemaining, type Vencimiento } from "@/lib/utils";
import { getAllVencimientos, getAllPushSubscriptions } from "@/lib/queries";

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

  let vencimientos: Vencimiento[];
  try {
    vencimientos = await getAllVencimientos();
    console.log(LOG_PREFIX, "Loaded vencimientos:", vencimientos.length);
  } catch (err) {
    console.error(LOG_PREFIX, "Failed to load vencimientos from DB:", err);
    return Response.json(
      { error: "Failed to load vencimientos" },
      { status: 500 },
    );
  }

  const toAlert = vencimientos.filter(
    (p: Vencimiento) => p.vencimiento && isExpiringWithinThreeDays(p.vencimiento),
  );
  if (toAlert.length === 0) {
    console.log(LOG_PREFIX, "No products expiring within 3 days; nothing to send");
    return Response.json({ sent: 0, total: 0, pushSent: 0 });
  }
  console.log(
    LOG_PREFIX,
    "Products to alert:",
    toAlert.length,
    toAlert.map((p) => `${p.producto} (${p.categoria})`),
  );

  const pushPayload = JSON.stringify({
    title: "Vencimientos",
    body:
      toAlert.length === 1
        ? `1 producto vence en 3 días o menos: ${toAlert[0].producto}`
        : `${toAlert.length} productos vencen en 3 días o menos`,
  });

  let pushSent = 0;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (vapidPublic && vapidPrivate) {
    try {
      webpush.setVapidDetails("mailto:vencimientos@localhost", vapidPublic, vapidPrivate);
      const subs = await getAllPushSubscriptions();
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            pushPayload
          );
          pushSent++;
        } catch (pushErr) {
          console.error(LOG_PREFIX, "Push failed for subscription:", sub.endpoint?.slice(0, 50), pushErr);
        }
      }
      if (subs.length > 0) console.log(LOG_PREFIX, "Push sent:", pushSent, "of", subs.length);
    } catch (err) {
      console.error(LOG_PREFIX, "Push setup or send error:", err);
    }
  }

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

  console.log(LOG_PREFIX, "Finished. Sent:", sent, "of", toAlert.length, "pushSent:", pushSent);
  return Response.json({ sent, total: toAlert.length, pushSent });
}
