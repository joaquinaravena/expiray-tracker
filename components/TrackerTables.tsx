"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatExpiryDate, getDaysRemaining, toDateOnly, cn } from "@/lib/utils";
import type { TrackerData, Vencimiento, Vencido, Fallado } from "@/lib/utils";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type TableKind = "vencimientos" | "vencidos" | "fallados";

export function TrackerTables({
  data,
  onDataChange,
}: {
  data: TrackerData;
  onDataChange?: () => void;
}) {
  const { vencimientos, vencidos, fallados } = data;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKind, setDialogKind] = useState<TableKind>("vencimientos");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state (shared for create/edit)
  const [formProducto, setFormProducto] = useState("");
  const [formArticulo, setFormArticulo] = useState("");
  const [formVencimiento, setFormVencimiento] = useState("");
  const [formCategoria, setFormCategoria] = useState("");
  const [formCant, setFormCant] = useState(0);

  // Search filter per tab
  const [searchVencimientos, setSearchVencimientos] = useState("");
  const [searchVencidos, setSearchVencidos] = useState("");
  const [searchFallados, setSearchFallados] = useState("");

  const filterRows = <T extends { producto?: string; articulo?: string; categoria?: string; nombre?: string }>(
    rows: T[],
    q: string,
    keys: (keyof T)[]
  ) => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      keys.some((k) => {
        const v = row[k];
        return typeof v === "string" && v.toLowerCase().includes(term);
      })
    );
  };
  const filteredVencimientos = filterRows(vencimientos, searchVencimientos, ["producto", "articulo", "categoria"]);
  const filteredVencidos = filterRows(vencidos, searchVencidos, ["articulo", "nombre"]);
  const filteredFallados = filterRows(fallados, searchFallados, ["articulo", "nombre"]);

  // Search inside "Agregar" dialog (solo al crear)
  const [productSearchQ, setProductSearchQ] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<{ id: string; name: string; articulo?: string | null }[]>([]);

  const openCreate = (kind: TableKind, preselectedProduct?: { name: string; articulo?: string | null }) => {
    setDialogKind(kind);
    setEditingId(null);
    setFormProducto(preselectedProduct?.name ?? "");
    setFormArticulo(preselectedProduct?.articulo ?? "");
    setFormVencimiento("");
    setFormCategoria("");
    setFormCant(0);
    setProductSearchQ("");
    setProductSearchResults([]);
    setDialogOpen(true);
  };

  const openEdit = (kind: TableKind, row: Vencimiento | Vencido | Fallado) => {
    setDialogKind(kind);
    setEditingId(row.id ?? null);
    if (kind === "vencimientos") {
      const r = row as Vencimiento;
      setFormProducto(r.producto);
      setFormArticulo(r.articulo ?? "");
      setFormVencimiento(toDateOnly(r.vencimiento));
      setFormCategoria(r.categoria ?? "");
      setFormCant(0);
    } else if (kind === "vencidos") {
      const r = row as Vencido;
      setFormProducto(r.nombre ?? "");
      setFormArticulo(r.articulo ?? "");
      setFormVencimiento(toDateOnly(r.fecha_venci ?? ""));
      setFormCategoria("");
      setFormCant(r.cant ?? 0);
    } else {
      const r = row as Fallado;
      setFormProducto(r.nombre ?? "");
      setFormArticulo(r.articulo ?? "");
      setFormVencimiento("");
      setFormCategoria("");
      setFormCant(r.cant ?? 0);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProducto.trim()) {
      toast.error("Producto/Artículo es requerido");
      return;
    }
    setSaving(true);
    try {
      const base = "/api";
      if (dialogKind === "vencimientos") {
        if (!formVencimiento.trim()) {
          toast.error("Fecha de vencimiento es requerida");
          setSaving(false);
          return;
        }
        if (editingId) {
          const res = await fetch(`${base}/vencimientos/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productName: formProducto.trim(),
              expiry_date: formVencimiento,
              category: formCategoria || null,
              articulo: formArticulo.trim() || null,
            }),
          });
          if (!res.ok) throw new Error("Error al actualizar");
        } else {
          const res = await fetch(`${base}/vencimientos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productName: formProducto.trim(),
              articulo: formArticulo.trim() || null,
              expiry_date: formVencimiento,
              category: formCategoria || null,
            }),
          });
          if (!res.ok) throw new Error("Error al crear");
        }
      } else if (dialogKind === "vencidos") {
        if (editingId) {
          const res = await fetch(`${base}/vencidos/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productName: formProducto.trim(),
              articulo: formArticulo.trim() || null,
              expiry_date: formVencimiento || null,
              stock: formCant,
            }),
          });
          if (!res.ok) throw new Error("Error al actualizar");
        } else {
          const res = await fetch(`${base}/vencidos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productName: formProducto.trim(),
              articulo: formArticulo.trim() || null,
              expiry_date: formVencimiento || null,
              stock: formCant,
            }),
          });
          if (!res.ok) throw new Error("Error al crear");
        }
      } else {
        if (editingId) {
          const res = await fetch(`${base}/fallados/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productName: formProducto.trim(),
              articulo: formArticulo.trim() || null,
              stock: formCant,
            }),
          });
          if (!res.ok) throw new Error("Error al actualizar");
        } else {
          const res = await fetch(`${base}/fallados`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productName: formProducto.trim(),
              articulo: formArticulo.trim() || null,
              stock: formCant,
            }),
          });
          if (!res.ok) throw new Error("Error al crear");
        }
      }
      toast.success(editingId ? "Actualizado" : "Creado");
      setDialogOpen(false);
      onDataChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (kind: TableKind, id: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      const res = await fetch(`/api/${kind}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success("Eliminado");
      onDataChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const dialogTitle =
    dialogKind === "vencimientos"
      ? editingId
        ? "Editar vencimiento"
        : "Nuevo vencimiento"
      : dialogKind === "vencidos"
        ? editingId
          ? "Editar vencido"
          : "Nuevo vencido"
        : editingId
          ? "Editar fallado"
          : "Nuevo fallado";

  return (
    <>
      <Tabs defaultValue="vencimientos" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vencimientos">Vencimientos</TabsTrigger>
          <TabsTrigger value="vencidos">Vencidos</TabsTrigger>
          <TabsTrigger value="fallados">Fallados</TabsTrigger>
        </TabsList>

        <TabsContent value="vencimientos" className="mt-4">
          <div className="mb-2 flex w-full items-center gap-2">
            <Input
              placeholder="Buscar (producto, artículo, categoría)..."
              value={searchVencimientos}
              onChange={(e) => setSearchVencimientos(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button size="sm" onClick={() => openCreate("vencimientos")} className="shrink-0 gap-1">
              <Plus className="size-4" />
              Agregar
            </Button>
          </div>
          <div className="w-full overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Días restantes</TableHead>
                  <TableHead className="w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVencimientos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {vencimientos.length === 0 ? "No hay productos." : "No hay coincidencias con la búsqueda."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVencimientos.map((row, i) => {
                    const hasVencimiento = !!row.vencimiento?.trim();
                    const days = hasVencimiento ? getDaysRemaining(row.vencimiento) : null;
                    return (
                      <TableRow key={row.id ?? `v-${i}-${row.product_id ?? row.producto}`}>
                        <TableCell className="font-medium">{row.articulo || "—"}</TableCell>
                        <TableCell>{row.producto || "—"}</TableCell>
                        <TableCell>{hasVencimiento ? formatExpiryDate(row.vencimiento) : "—"}</TableCell>
                        <TableCell>{row.categoria || "—"}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            days != null && days < 3 && "text-red-600 dark:text-red-400",
                          )}
                        >
                          {days != null ? days : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEdit("vencimientos", row)}
                              aria-label={row.id ? "Editar" : "Agregar vencimiento"}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            {row.id && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleDelete("vencimientos", row.id!)}
                                className="text-destructive hover:text-destructive"
                                aria-label="Eliminar"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="vencidos" className="mt-4">
          <div className="mb-2 flex w-full items-center gap-2">
            <Input
              placeholder="Buscar (artículo, nombre)..."
              value={searchVencidos}
              onChange={(e) => setSearchVencidos(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button size="sm" onClick={() => openCreate("vencidos")} className="shrink-0 gap-1">
              <Plus className="size-4" />
              Agregar
            </Button>
          </div>
          <div className="w-full overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Fecha vencida</TableHead>
                  <TableHead className="text-right">Cant</TableHead>
                  <TableHead className="w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVencidos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {vencidos.length === 0 ? "No hay productos vencidos." : "No hay coincidencias con la búsqueda."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVencidos.map((row, i) => (
                    <TableRow key={row.id ?? `vd-${i}-${row.articulo}-${row.fecha_venci}`}>
                      <TableCell className="font-medium">{row.articulo || "—"}</TableCell>
                      <TableCell>{row.nombre || "—"}</TableCell>
                      <TableCell>
                        {row.fecha_venci ? formatExpiryDate(row.fecha_venci) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{Number.isFinite(row.cant) ? row.cant : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => row.id && openEdit("vencidos", row)}
                            disabled={!row.id}
                            aria-label="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => row.id && handleDelete("vencidos", row.id)}
                            disabled={!row.id}
                            className="text-destructive hover:text-destructive"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="fallados" className="mt-4">
          <div className="mb-2 flex w-full items-center gap-2">
            <Input
            placeholder="Buscar (artículo, nombre)..."
            value={searchFallados}
              onChange={(e) => setSearchFallados(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button size="sm" onClick={() => openCreate("fallados")} className="shrink-0 gap-1">
              <Plus className="size-4" />
              Agregar
            </Button>
          </div>
          <div className="w-full overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Cant</TableHead>
                  <TableHead className="w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFallados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      {fallados.length === 0 ? "No hay productos fallados." : "No hay coincidencias con la búsqueda."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFallados.map((row, i) => (
                    <TableRow key={row.id ?? `f-${i}-${row.articulo}`}>
                      <TableCell className="font-medium">{row.articulo || "—"}</TableCell>
                      <TableCell>{row.nombre || "—"}</TableCell>
                      <TableCell className="text-right">{Number.isFinite(row.cant) ? row.cant : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => row.id && openEdit("fallados", row)}
                            disabled={!row.id}
                            aria-label="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => row.id && handleDelete("fallados", row.id)}
                            disabled={!row.id}
                            className="text-destructive hover:text-destructive"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title={dialogTitle}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          {!editingId && (
            <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/25 bg-muted/20 p-2.5">
              <label className="block text-sm font-medium">Buscar producto existente (opcional)</label>
              <Input
                className="w-full"
                placeholder="Escribí para buscar por nombre o artículo..."
                value={productSearchQ}
                onChange={async (e) => {
                  const v = e.target.value;
                  setProductSearchQ(v);
                  if (v.trim().length < 2) {
                    setProductSearchResults([]);
                    return;
                  }
                  try {
                    const res = await fetch(`/api/products?q=${encodeURIComponent(v)}&limit=15`);
                    const list = await res.json();
                    setProductSearchResults(Array.isArray(list) ? list : []);
                  } catch {
                    setProductSearchResults([]);
                  }
                }}
              />
              {productSearchResults.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {productSearchResults.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFormProducto(p.name);
                        setFormArticulo(p.articulo ?? "");
                        setProductSearchQ("");
                        setProductSearchResults([]);
                      }}
                    >
                      {p.articulo || p.name}
                    </Button>
                  ))}
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-auto py-1 text-muted-foreground"
                onClick={() => {
                  setFormProducto("");
                  setFormArticulo("");
                  setProductSearchQ("");
                  setProductSearchResults([]);
                }}
              >
                Crear producto nuevo (no seleccionar)
              </Button>
            </div>
          )}
          {(dialogKind === "vencimientos" || dialogKind === "vencidos" || !editingId) && (
            <div>
              <label className="mb-1 block text-sm font-medium">Producto</label>
              <Input
                className="w-full"
                value={formProducto}
                onChange={(e) => setFormProducto(e.target.value)}
                placeholder="Nombre del producto"
              />
            </div>
          )}
          {dialogKind === "vencimientos" && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Artículo (opcional)</label>
                <Input
                  className="w-full"
                  value={formArticulo}
                  onChange={(e) => setFormArticulo(e.target.value)}
                  placeholder="Código o nombre de artículo"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Fecha vencimiento (YYYY-MM-DD)</label>
                <Input
                  className="w-full"
                  type="date"
                  value={formVencimiento}
                  onChange={(e) => setFormVencimiento(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Categoría</label>
                <Input
                  className="w-full"
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                  placeholder="Ej. ALMACEN, LACTEOS"
                />
              </div>
            </>
          )}
          {(dialogKind === "vencidos" || dialogKind === "fallados") && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Artículo (opcional)</label>
                <Input
                  className="w-full"
                  value={formArticulo}
                  onChange={(e) => setFormArticulo(e.target.value)}
                  placeholder="Código o nombre de artículo"
                />
              </div>
              {dialogKind === "vencidos" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Fecha vencida (YYYY-MM-DD)</label>
                  <Input
                    className="w-full"
                    type="date"
                    value={formVencimiento}
                    onChange={(e) => setFormVencimiento(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Cantidad</label>
                <Input
                  className="w-full"
                  type="number"
                  min={0}
                  value={formCant}
                  onChange={(e) => setFormCant(Number(e.target.value) || 0)}
                />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : editingId ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
