import { NextRequest, NextResponse } from "next/server";
import { getAllVencimientos, createVencimiento } from "@/lib/queries";

export async function GET() {
  try {
    const rows = await getAllVencimientos();
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/vencimientos]", err);
    return NextResponse.json({ error: "Error al listar" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productName, articulo, expiry_date, category, productId } = body as {
      productName: string;
      articulo?: string | null;
      expiry_date: string;
      category?: string | null;
      productId?: string | null;
    };
    if (!productName?.trim() || !expiry_date) {
      return NextResponse.json(
        { error: "productName y expiry_date son requeridos" },
        { status: 400 }
      );
    }
    const row = await createVencimiento({
      productName: productName.trim(),
      articulo: articulo != null ? String(articulo).trim() || null : null,
      expiry_date,
      category: category ?? null,
      productId: productId?.trim() || undefined,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("[POST /api/vencimientos]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear" },
      { status: 500 }
    );
  }
}
