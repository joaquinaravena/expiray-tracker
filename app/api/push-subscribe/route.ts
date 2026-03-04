import { NextRequest, NextResponse } from "next/server";
import { savePushSubscription } from "@/lib/queries";

export async function POST(request: NextRequest) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Push not configured (VAPID keys missing)" },
      { status: 503 }
    );
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;

  if (!endpoint || typeof endpoint !== "string") {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }
  if (!p256dh || typeof p256dh !== "string") {
    return NextResponse.json({ error: "Missing keys.p256dh" }, { status: 400 });
  }
  if (!auth || typeof auth !== "string") {
    return NextResponse.json({ error: "Missing keys.auth" }, { status: 400 });
  }

  try {
    await savePushSubscription({ endpoint, p256dh, auth });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/push-subscribe]", err);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }
}
