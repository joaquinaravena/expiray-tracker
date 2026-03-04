import { NextRequest, NextResponse } from "next/server";
import {
  getFalladoById,
  updateFallado,
  deleteFallado,
  updateProductName,
  updateProductArticulo,
} from "@/lib/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await getFalladoById(id);
    if (!row) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    console.error("[GET /api/fallados/:id]", err);
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
    const { productName, articulo, stock } = body as {
      productName?: string;
      articulo?: string | null;
      stock?: number;
    };
    const existing = await getFalladoById(id);
    if (!existing) return NextResponse.json(null, { status: 404 });
    if (existing.product_id) {
      if (productName !== undefined && productName.trim()) {
        await updateProductName(existing.product_id, productName);
      }
      if (articulo !== undefined) {
        await updateProductArticulo(existing.product_id, articulo?.trim() || null);
      }
    }
    const updated = await updateFallado(id, { stock });
    if (!updated) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/fallados/:id]", err);
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
    const ok = await deleteFallado(id);
    if (!ok) return NextResponse.json(null, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/fallados/:id]", err);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
