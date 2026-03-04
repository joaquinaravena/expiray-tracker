import { NextResponse } from "next/server";
import { getAllVencimientos, getAllVencidos, getAllFallados } from "@/lib/queries";

export async function GET() {
  try {
    const [vencimientos, vencidos, fallados] = await Promise.all([
      getAllVencimientos(),
      getAllVencidos(),
      getAllFallados(),
    ]);
    return NextResponse.json({
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
