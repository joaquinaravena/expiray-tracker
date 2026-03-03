"use client";

import { useEffect, useState, useRef } from "react";
import { TrackerTables } from "@/components/TrackerTables";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { TrackerData } from "@/lib/utils";
import { Download, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";

const EMPTY_TRACKER: TrackerData = {
  vencimientos: [],
  vencidos: [],
  fallados: [],
};

export default function Home() {
  const [data, setData] = useState<TrackerData>(EMPTY_TRACKER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importedData, setImportedData] = useState<TrackerData | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTracker = async () => {
    setLoading(true);
    setError(null);
    setImportedData(null);
    try {
      const res = await fetch("/data/tracker.json");
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
      setData({
        vencimientos: Array.isArray(tracker.vencimientos) ? tracker.vencimientos : [],
        vencidos: Array.isArray(tracker.vencidos) ? tracker.vencidos : [],
        fallados: Array.isArray(tracker.fallados) ? tracker.fallados : [],
      });
      setImportedData(tracker);
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

  const handleDownloadTrackerJson = () => {
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "tracker.json";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("tracker.json descargado. Reemplaza public/data/tracker.json y redespliega.");
    } catch {
      toast.error("Error al descargar");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Expiry Tracker</CardTitle>
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
              {importedData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTrackerJson}
                  className="gap-2"
                >
                  <Download className="size-4" />
                  Descargar tracker.json
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchTracker}
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Recargar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="py-8 text-center text-destructive">{error}</p>
            ) : (
              <TrackerTables data={data} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
