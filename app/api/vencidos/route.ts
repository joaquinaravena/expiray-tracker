import { NextRequest, NextResponse } from "next/server";
import { getAllVencidos, createVencido } from "@/lib/queries";
import { DEFAULT_BRANCH, normalizeBranchCode } from "@/lib/branches";

export async function GET(request: NextRequest) {
  try {
    const branchParam = request.nextUrl.searchParams.get("branch");
    const branch = branchParam ? normalizeBranchCode(branchParam) : DEFAULT_BRANCH;
    if (!branch) {
      return NextResponse.json({ error: "branch inválido. Usa don-bosco o alem" }, { status: 400 });
    }
    const rows = await getAllVencidos(branch);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/vencidos]", err);
    return NextResponse.json({ error: "Error al listar" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productName, articulo, expiry_date, stock, productId, branch } = body as {
      productName: string;
      articulo?: string | null;
      expiry_date?: string | null;
      stock?: number;
      productId?: string | null;
      branch?: string;
    };
    const normalizedBranch = normalizeBranchCode(branch ?? DEFAULT_BRANCH);
    if (!normalizedBranch) {
      return NextResponse.json({ error: "branch inválido. Usa don-bosco o alem" }, { status: 400 });
    }
    if (!productName?.trim()) {
      return NextResponse.json(
        { error: "productName es requerido" },
        { status: 400 }
      );
    }
    const row = await createVencido({
      productName: productName.trim(),
      articulo: articulo != null ? String(articulo).trim() || null : null,
      expiry_date: expiry_date ?? null,
      stock: stock ?? 0,
      productId: productId?.trim() || undefined,
      branchCode: normalizedBranch,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("[POST /api/vencidos]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear" },
      { status: 500 }
    );
  }
}
