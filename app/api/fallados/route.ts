import { NextRequest, NextResponse } from "next/server";
import { getAllFallados, createFallado } from "@/lib/queries";

export async function GET() {
  try {
    const rows = await getAllFallados();
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/fallados]", err);
    return NextResponse.json({ error: "Error al listar" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productName, articulo, stock, productId } = body as {
      productName: string;
      articulo?: string | null;
      stock?: number;
      productId?: string | null;
    };
    if (!productName?.trim()) {
      return NextResponse.json(
        { error: "productName es requerido" },
        { status: 400 }
      );
    }
    const row = await createFallado({
      productName: productName.trim(),
      articulo: articulo != null ? String(articulo).trim() || null : null,
      stock: stock ?? 0,
      productId: productId?.trim() || undefined,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("[POST /api/fallados]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear" },
      { status: 500 }
    );
  }
}
