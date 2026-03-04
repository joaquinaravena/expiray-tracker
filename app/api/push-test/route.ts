import webpush from "web-push";
import { getAllPushSubscriptions } from "@/lib/queries";

export async function POST() {
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    return Response.json({ error: "Push no configurado (VAPID keys)" }, { status: 500 });
  }

  const pushPayload = JSON.stringify({
    title: "Prueba de notificación",
    body: "Push de prueba desde Vencimientos. Si ves esto, las notificaciones funcionan.",
  });

  let pushSent = 0;
  let totalSubs = 0;
  try {
    webpush.setVapidDetails("mailto:vencimientos@localhost", vapidPublic, vapidPrivate);
    const subs = await getAllPushSubscriptions();
    totalSubs = subs.length;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          pushPayload
        );
        pushSent++;
      } catch (pushErr) {
        console.error("[push-test] Push failed for subscription:", sub.endpoint?.slice(0, 50), pushErr);
      }
    }
  } catch (err) {
    console.error("[push-test]", err);
    return Response.json({ error: "Error al enviar push" }, { status: 500 });
  }

  return Response.json({ pushSent, total: totalSubs });
}
