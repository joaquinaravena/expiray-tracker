"use client";

import { useEffect, useState, useRef } from "react";
import { TrackerTables } from "@/components/TrackerTables";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { TrackerData } from "@/lib/utils";
import { FileSpreadsheet, Loader2 } from "lucide-react";

const EMPTY_TRACKER: TrackerData = {
  vencimientos: [],
  vencidos: [],
  fallados: [],
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function Home() {
  const [data, setData] = useState<TrackerData>(EMPTY_TRACKER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importedData, setImportedData] = useState<TrackerData | null>(null);
  const onDataChange = () => fetchTracker();
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setPushSupported(supported);
    if (!supported) return;

    const checkSubscription = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setPushSubscribed(true);
          return;
        }
        const dismissed = sessionStorage.getItem("notification-prompt-dismissed");
        if (dismissed) {
          const t = parseInt(dismissed, 10);
          if (!isNaN(t) && Date.now() - t < 7 * 24 * 60 * 60 * 1000) return;
        }
        setShowNotificationPrompt(true);
      } catch {
        setShowNotificationPrompt(true);
      }
    };
    checkSubscription();
  }, []);

  const fetchTracker = async () => {
    setLoading(true);
    setError(null);
    setImportedData(null);
    try {
      const res = await fetch("/api/tracker");
      if (!res.ok) throw new Error("Error al cargar datos");
      const json: TrackerData = await res.json();
      if (!json || typeof json !== "object") throw new Error("Formato inválido");
      setData({
        vencimientos: Array.isArray(json.vencimientos) ? json.vencimientos : [],
        vencidos: Array.isArray(json.vencidos) ? json.vencidos : [],
        fallados: Array.isArray(json.fallados) ? json.fallados : [],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracker();
  }, []);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportedData(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al importar");
      const tracker = result.data as TrackerData;
      if (!tracker) throw new Error("No se recibieron datos");
      setImportedData(tracker);
      setData({
        vencimientos: Array.isArray(tracker.vencimientos) ? tracker.vencimientos : [],
        vencidos: Array.isArray(tracker.vencidos) ? tracker.vencidos : [],
        fallados: Array.isArray(tracker.fallados) ? tracker.fallados : [],
      });
      if (result.warnings?.length) {
        result.warnings.forEach((w: string) => toast.warning(w));
      }
      toast.success(
        `Importado: ${tracker.vencimientos?.length ?? 0} vencimientos, ${tracker.vencidos?.length ?? 0} vencidos, ${tracker.fallados?.length ?? 0} fallados`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar Excel");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleEnablePush = async () => {
    if (!pushSupported || pushLoading) return;
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Permiso de notificaciones denegado");
        return;
      }
      const vapidRes = await fetch("/api/push-vapid-public");
      if (!vapidRes.ok) {
        const err = await vapidRes.json().catch(() => ({}));
        toast.error(err.error || "Push no configurado");
        return;
      }
      const { publicKey } = await vapidRes.json();
      if (!publicKey) {
        toast.error("Clave pública no disponible");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const subJson = sub.toJSON();
      const res = await fetch("/api/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al activar notificaciones");
      }
      setPushSubscribed(true);
      setShowNotificationPrompt(false);
      toast.success("Notificaciones activadas. Recibirás un aviso cuando haya productos por vencer.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al activar notificaciones");
    } finally {
      setPushLoading(false);
    }
  };

  const handleDismissNotificationPrompt = () => {
    sessionStorage.setItem("notification-prompt-dismissed", String(Date.now()));
    setShowNotificationPrompt(false);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Vencimientos</CardTitle>
              <CardDescription>
                Vencimientos, vencidos y fallados. Días en rojo: menos de 3 días. Sube un Excel con las 3 secciones.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="gap-2"
              >
                {importing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="size-4" />
                )}
                Cargar Excel
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>
          </CardHeader>
          <Dialog
            open={showNotificationPrompt}
            onOpenChange={(open) => !open && handleDismissNotificationPrompt()}
            title="Notificaciones"
          >
            <p className="text-muted-foreground mb-4">
              ¿Quieres recibir avisos cuando haya productos por vencer?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleDismissNotificationPrompt}>
                Ahora no
              </Button>
              <Button onClick={handleEnablePush} disabled={pushLoading} className="gap-2">
                {pushLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                Sí, activar
              </Button>
            </div>
          </Dialog>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="py-8 text-center text-destructive">{error}</p>
            ) : (
              <TrackerTables data={data} onDataChange={onDataChange} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
