import { NextRequest, NextResponse } from "next/server";
import {
  getVencidoById,
  updateVencido,
  deleteVencido,
  updateProductName,
  updateProductArticulo,
} from "@/lib/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await getVencidoById(id);
    if (!row) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    console.error("[GET /api/vencidos/:id]", err);
    return NextResponse.json({ error: "Error al obtener" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { productName, articulo, expiry_date, stock } = body as {
      productName?: string;
      articulo?: string | null;
      expiry_date?: string | null;
      stock?: number;
    };
    const existing = await getVencidoById(id);
    if (!existing) return NextResponse.json(null, { status: 404 });
    if (existing.product_id) {
      if (productName !== undefined && productName.trim()) {
        await updateProductName(existing.product_id, productName);
      }
      if (articulo !== undefined) {
        await updateProductArticulo(existing.product_id, articulo?.trim() || null);
      }
    }
    const updated = await updateVencido(id, {
      expiry_date,
      stock,
    });
    if (!updated) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/vencidos/:id]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ok = await deleteVencido(id);
    if (!ok) return NextResponse.json(null, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/vencidos/:id]", err);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
