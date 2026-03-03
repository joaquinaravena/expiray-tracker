"use client";

import { useEffect, useState, useRef } from "react";
import { DataTable, type Product } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<Product[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/data/products.json");
      if (!res.ok) throw new Error("Error al cargar datos");
      const data: Product[] = await res.json();
      if (!Array.isArray(data)) throw new Error("Formato inválido");
      setProducts(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDownloadTemplate = () => {
    try {
      const link = document.createElement("a");
      link.href = "/template-products.json";
      link.download = "products-template.json";
      link.click();
      toast.success("Plantilla descargada");
    } catch {
      toast.error("Error al descargar");
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportPreview(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al importar");
      setImportPreview(data.products ?? []);
      if (data.errors?.length) {
        data.errors.forEach((err: string) => toast.warning(err));
      }
      toast.success(`Vista previa: ${data.products?.length ?? 0} productos`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar Excel");
    } finally {
      setImporting(false);
      e.target.value = "";
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
                  Productos y fechas de vencimiento. Días en rojo: menos de 3 días.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="gap-2"
                >
                  <Download className="size-4" />
                  Actualizar Datos (template)
                </Button>
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
                  Vista previa Excel
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={fetchProducts}
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
                <>
                  <DataTable products={products} />
                  {importPreview !== null && (
                    <div className="mt-6 border-t pt-6">
                      <p className="mb-2 text-sm font-medium text-muted-foreground">
                        Vista previa desde Excel (no se guarda; copia el JSON a public/data/products.json y redespliega)
                      </p>
                      <DataTable products={importPreview} />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
