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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatExpiryDateShort, getDaysRemaining, toDateOnly, cn } from "@/lib/utils";
import type { TrackerData, Vencimiento, Vencido, Fallado } from "@/lib/utils";
import { Pencil, Trash2, Plus, ArrowRight } from "lucide-react";
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
  /** When adding a vencimiento/vencido/fallado to a product that has none, we pass this so the backend updates that product instead of creating a new one. */
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state (shared for create/edit)
  const [formProducto, setFormProducto] = useState("");
  const [formArticulo, setFormArticulo] = useState("");
  const [formVencimiento, setFormVencimiento] = useState("");
  const [formCategoria, setFormCategoria] = useState("");
  const [formCant, setFormCant] = useState(0);

  // Delete confirmation dialog (single id or multiple ids for bulk delete)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    kind: TableKind;
    id?: string;
    ids?: string[];
  } | null>(null);

  // Multi-select for bulk delete (only rows with id are selectable)
  const [selectedVencimientos, setSelectedVencimientos] = useState<Set<string>>(new Set());
  const [selectedVencidos, setSelectedVencidos] = useState<Set<string>>(new Set());
  const [selectedFallados, setSelectedFallados] = useState<Set<string>>(new Set());

  // Dialog: move vencimiento → vencidos (only stock to fill)
  const [moveToVencidosRow, setMoveToVencidosRow] = useState<Vencimiento | null>(null);
  const [moveToVencidosStock, setMoveToVencidosStock] = useState(0);
  const [moveToVencidosSaving, setMoveToVencidosSaving] = useState(false);

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

  const openCreate = (kind: TableKind, preselectedProduct?: { name: string; articulo?: string | null; productId?: string }) => {
    setDialogKind(kind);
    setEditingId(null);
    setEditingProductId(preselectedProduct?.productId ?? null);
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
    const rowId = row.id ?? null;
    setEditingId(rowId);
    setEditingProductId(rowId ? null : (row.product_id ?? null));
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
              productId: editingProductId || undefined,
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
              productId: editingProductId || undefined,
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
              productId: editingProductId || undefined,
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

  const handleDeleteClick = (kind: TableKind, id: string) => {
    setDeleteConfirm({ kind, id });
  };

  const handleBulkDeleteClick = (kind: TableKind) => {
    const ids =
      kind === "vencimientos"
        ? Array.from(selectedVencimientos)
        : kind === "vencidos"
          ? Array.from(selectedVencidos)
          : Array.from(selectedFallados);
    if (ids.length === 0) return;
    setDeleteConfirm({ kind, ids });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const { kind, id, ids } = deleteConfirm;
    const toDelete = ids && ids.length > 0 ? ids : id ? [id] : [];
    for (const idToDelete of toDelete) {
      const res = await fetch(`/api/${kind}/${idToDelete}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
    }
    toast.success(toDelete.length > 1 ? `${toDelete.length} eliminados` : "Eliminado");
    if (kind === "vencimientos") setSelectedVencimientos(new Set());
    else if (kind === "vencidos") setSelectedVencidos(new Set());
    else setSelectedFallados(new Set());
    setDeleteConfirm(null);
    onDataChange?.();
  };

  const toggleSelectRow = (kind: TableKind, id: string, checked: boolean) => {
    if (kind === "vencimientos") {
      setSelectedVencimientos((prev) => {
        const next = new Set(prev);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      });
    } else if (kind === "vencidos") {
      setSelectedVencidos((prev) => {
        const next = new Set(prev);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      });
    } else {
      setSelectedFallados((prev) => {
        const next = new Set(prev);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      });
    }
  };

  const toggleSelectAll = (kind: TableKind, checked: boolean) => {
    const rows =
      kind === "vencimientos"
        ? filteredVencimientos.filter((r) => r.id)
        : kind === "vencidos"
          ? filteredVencidos.filter((r) => r.id)
          : filteredFallados.filter((r) => r.id);
    const ids = rows.map((r) => r.id!);
    if (kind === "vencimientos") setSelectedVencimientos(checked ? new Set(ids) : new Set());
    else if (kind === "vencidos") setSelectedVencidos(checked ? new Set(ids) : new Set());
    else setSelectedFallados(checked ? new Set(ids) : new Set());
  };

  const handleMoveToVencidos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveToVencidosRow) return;
    setMoveToVencidosSaving(true);
    try {
      const base = "/api";
      const res = await fetch(`${base}/vencidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: moveToVencidosRow.producto.trim(),
          articulo: moveToVencidosRow.articulo?.trim() || null,
          expiry_date: moveToVencidosRow.vencimiento ? toDateOnly(moveToVencidosRow.vencimiento) : null,
          stock: moveToVencidosStock,
          productId: moveToVencidosRow.product_id || undefined,
        }),
      });
      if (!res.ok) throw new Error("Error al crear en vencidos");
      if (moveToVencidosRow.id) {
        const delRes = await fetch(`${base}/vencimientos/${moveToVencidosRow.id}`, { method: "DELETE" });
        if (!delRes.ok) throw new Error("Error al eliminar de vencimientos");
      }
      toast.success("Pasado a vencidos");
      setMoveToVencidosRow(null);
      onDataChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setMoveToVencidosSaving(false);
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
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={deleteConfirm?.ids && deleteConfirm.ids.length > 1 ? "Eliminar registros" : "Eliminar registro"}
        description={
          deleteConfirm?.ids && deleteConfirm.ids.length > 1
            ? `¿Eliminar ${deleteConfirm.ids.length} registros? Esta acción no se puede deshacer.`
            : "¿Eliminar este registro? Esta acción no se puede deshacer."
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
      <Tabs defaultValue="vencimientos" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vencimientos">Vencimientos</TabsTrigger>
          <TabsTrigger value="vencidos">Vencidos</TabsTrigger>
          <TabsTrigger value="fallados">Fallados</TabsTrigger>
        </TabsList>

        <TabsContent value="vencimientos" className="mt-4">
          <div className="mb-2 flex w-full flex-wrap items-center gap-2">
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
            {selectedVencimientos.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBulkDeleteClick("vencimientos")}
                className="shrink-0"
              >
                Eliminar seleccionados ({selectedVencimientos.size})
              </Button>
            )}
          </div>
          <div className="w-full rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      role="checkbox"
                      aria-label="Seleccionar todos"
                      className="h-4 w-4 rounded border-input"
                      checked={
                        filteredVencimientos.filter((r) => r.id).length > 0 &&
                        filteredVencimientos.every((r) => !r.id || selectedVencimientos.has(r.id))
                      }
                      onChange={(e) =>
                        toggleSelectAll("vencimientos", e.target.checked)
                      }
                    />
                  </TableHead>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Días restantes</TableHead>
                  <TableHead className="w-[100px] whitespace-nowrap">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVencimientos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {vencimientos.length === 0 ? "No hay productos." : "No hay coincidencias con la búsqueda."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVencimientos.map((row, i) => {
                    const hasVencimiento = !!row.vencimiento?.trim();
                    const days = hasVencimiento ? getDaysRemaining(row.vencimiento) : null;
                    const canSelect = !!row.id;
                    return (
                      <TableRow key={row.id ?? `v-${i}-${row.product_id ?? row.producto}`}>
                        <TableCell className="whitespace-nowrap">
                          {canSelect ? (
                            <input
                              type="checkbox"
                              role="checkbox"
                              aria-label="Seleccionar"
                              className="h-4 w-4 rounded border-input"
                              checked={selectedVencimientos.has(row.id!)}
                              onChange={(e) =>
                                toggleSelectRow("vencimientos", row.id!, e.target.checked)
                              }
                            />
                          ) : null}
                        </TableCell>
                        <TableCell className="font-medium">{row.articulo || "—"}</TableCell>
                        <TableCell>{row.producto || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {hasVencimiento ? formatExpiryDateShort(row.vencimiento) : "—"}
                        </TableCell>
                        <TableCell>{row.categoria || "—"}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            days != null && days < 3 && "text-red-600 dark:text-red-400",
                          )}
                        >
                          {days != null ? days : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex gap-1">
                            {row.id && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  setMoveToVencidosRow(row);
                                  setMoveToVencidosStock(0);
                                }}
                                aria-label="Pasar a vencidos"
                                title="Pasar a vencidos"
                              >
                                <ArrowRight className="size-4" />
                              </Button>
                            )}
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
                                onClick={() => handleDeleteClick("vencimientos", row.id!)}
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
          <div className="mb-2 flex w-full flex-wrap items-center gap-2">
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
            {selectedVencidos.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBulkDeleteClick("vencidos")}
                className="shrink-0"
              >
                Eliminar seleccionados ({selectedVencidos.size})
              </Button>
            )}
          </div>
          <div className="w-full rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      role="checkbox"
                      aria-label="Seleccionar todos"
                      className="h-4 w-4 rounded border-input"
                      checked={
                        filteredVencidos.filter((r) => r.id).length > 0 &&
                        filteredVencidos.every((r) => !r.id || selectedVencidos.has(r.id))
                      }
                      onChange={(e) => toggleSelectAll("vencidos", e.target.checked)}
                    />
                  </TableHead>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Fecha vencida</TableHead>
                  <TableHead className="text-right">Cant</TableHead>
                  <TableHead className="w-[80px] whitespace-nowrap">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVencidos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {vencidos.length === 0 ? "No hay productos vencidos." : "No hay coincidencias con la búsqueda."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVencidos.map((row, i) => (
                    <TableRow key={row.id ?? `vd-${i}-${row.articulo}-${row.fecha_venci}`}>
                      <TableCell className="whitespace-nowrap">
                        {row.id ? (
                          <input
                            type="checkbox"
                            role="checkbox"
                            aria-label="Seleccionar"
                            className="h-4 w-4 rounded border-input"
                            checked={selectedVencidos.has(row.id)}
                            onChange={(e) => toggleSelectRow("vencidos", row.id!, e.target.checked)}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium">{row.articulo || "—"}</TableCell>
                      <TableCell>{row.nombre || "—"}</TableCell>
                      <TableCell>
                        {row.fecha_venci ? formatExpiryDateShort(row.fecha_venci) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{Number.isFinite(row.cant) ? row.cant : "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
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
                            onClick={() => row.id && handleDeleteClick("vencidos", row.id)}
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
          <div className="mb-2 flex w-full flex-wrap items-center gap-2">
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
            {selectedFallados.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBulkDeleteClick("fallados")}
                className="shrink-0"
              >
                Eliminar seleccionados ({selectedFallados.size})
              </Button>
            )}
          </div>
          <div className="w-full rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      role="checkbox"
                      aria-label="Seleccionar todos"
                      className="h-4 w-4 rounded border-input"
                      checked={
                        filteredFallados.filter((r) => r.id).length > 0 &&
                        filteredFallados.every((r) => !r.id || selectedFallados.has(r.id))
                      }
                      onChange={(e) => toggleSelectAll("fallados", e.target.checked)}
                    />
                  </TableHead>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Cant</TableHead>
                  <TableHead className="w-[80px] whitespace-nowrap">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFallados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {fallados.length === 0 ? "No hay productos fallados." : "No hay coincidencias con la búsqueda."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFallados.map((row, i) => (
                    <TableRow key={row.id ?? `f-${i}-${row.articulo}`}>
                      <TableCell className="whitespace-nowrap">
                        {row.id ? (
                          <input
                            type="checkbox"
                            role="checkbox"
                            aria-label="Seleccionar"
                            className="h-4 w-4 rounded border-input"
                            checked={selectedFallados.has(row.id)}
                            onChange={(e) => toggleSelectRow("fallados", row.id!, e.target.checked)}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium">{row.articulo || "—"}</TableCell>
                      <TableCell>{row.nombre || "—"}</TableCell>
                      <TableCell className="text-right">{Number.isFinite(row.cant) ? row.cant : "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
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
                            onClick={() => row.id && handleDeleteClick("fallados", row.id)}
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
                        setEditingProductId(p.id);
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
                  setEditingProductId(null);
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

      <Dialog
        open={!!moveToVencidosRow}
        onOpenChange={(open) => !open && setMoveToVencidosRow(null)}
        title="Pasar a vencidos"
      >
        {moveToVencidosRow && (
          <form onSubmit={handleMoveToVencidos} className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              Completá la cantidad (stock). El resto de los datos se copian del vencimiento.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium">Producto</label>
              <Input className="w-full bg-muted" value={moveToVencidosRow.producto || "—"} readOnly disabled />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Artículo</label>
              <Input className="w-full bg-muted" value={moveToVencidosRow.articulo || "—"} readOnly disabled />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Fecha vencida</label>
              <Input
                className="w-full bg-muted"
                value={
                  moveToVencidosRow.vencimiento
                    ? formatExpiryDateShort(moveToVencidosRow.vencimiento)
                    : "—"
                }
                readOnly
                disabled
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Cantidad (stock) *</label>
              <Input
                className="w-full"
                type="number"
                min={0}
                value={moveToVencidosStock}
                onChange={(e) => setMoveToVencidosStock(Number(e.target.value) || 0)}
                placeholder="Ingresá la cantidad"
                required
              />
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMoveToVencidosRow(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={moveToVencidosSaving}>
                {moveToVencidosSaving ? "Guardando…" : "Pasar a vencidos"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
