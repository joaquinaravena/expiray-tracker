import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import { Resend } from "resend";
import { formatExpiryDate, getDaysRemaining } from "@/lib/utils";

type Product = { name: string; expiry_date: string };

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function isExpiringWithinThreeDays(expiryDateStr: string): boolean {
  const expiry = new Date(expiryDateStr + "T23:59:59").getTime();
  const limit = Date.now() + THREE_DAYS_MS;
  return expiry <= limit;
}

export async function GET(request: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const toEmail = process.env.TO_EMAIL || "tuemail@gmail.com";
  const fromEmail = "onboarding@resend.dev";
  const apiKey = process.env.RESEND_API_KEY;
  const resend = apiKey ? new Resend(apiKey) : null;

  let products: Product[];
  try {
    const path = process.cwd() + "/public/data/products.json";
    const raw = await fs.readFile(path, "utf-8");
    products = JSON.parse(raw);
    if (!Array.isArray(products)) products = [];
  } catch (err) {
    console.error("Cron: error reading products.json", err);
    return Response.json(
      { error: "Failed to read products.json" },
      { status: 500 }
    );
  }

  const toAlert = products.filter(
    (p) => p.expiry_date && isExpiringWithinThreeDays(p.expiry_date)
  );

  let sent = 0;
  for (const p of toAlert) {
    const days = getDaysRemaining(p.expiry_date);
    const formattedDate = formatExpiryDate(p.expiry_date);
    const subject = `Alerta: ${p.name} vence ${formattedDate}, días: ${days}`;
    const html = `Producto <strong>${p.name}</strong> vence el <strong>${formattedDate}</strong> en <strong>${days}</strong> días.`;

    try {
      if (!resend) {
        console.warn("Cron: RESEND_API_KEY not set, skipping email for", p.name);
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
        console.error("Cron: Resend error for", p.name, error);
      } else {
        console.log("Cron: email sent for", p.name, data?.id);
        sent++;
      }
    } catch (err) {
      console.error("Cron: send failed for", p.name, err);
    }
  }

  console.log("Cron: finished. Alerts sent:", sent, "of", toAlert.length);
  return Response.json({ sent, total: toAlert.length });
}
