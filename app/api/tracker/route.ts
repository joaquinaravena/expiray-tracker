import { NextResponse } from "next/server";
import { getAllVencimientos, getAllVencidos, getAllFallados } from "@/lib/queries";
import { DEFAULT_BRANCH, normalizeBranchCode } from "@/lib/branches";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchParam = searchParams.get("branch");
    const branch = branchParam ? normalizeBranchCode(branchParam) : DEFAULT_BRANCH;
    if (!branch) {
      return NextResponse.json({ error: "branch inválido. Usa don-bosco o alem" }, { status: 400 });
    }
    const [vencimientos, vencidos, fallados] = await Promise.all([
      getAllVencimientos(branch),
      getAllVencidos(branch),
      getAllFallados(branch),
    ]);
    return NextResponse.json({
      branch,
      vencimientos,
      vencidos,
      fallados,
    });
  } catch (err) {
    console.error("[GET /api/tracker]", err);
    return NextResponse.json(
      { error: "Error al cargar los datos" },
      { status: 500 }
    );
  }
}
