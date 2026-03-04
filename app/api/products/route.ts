import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 20, 50);
    const products = await searchProducts(q, limit);
    return NextResponse.json(products);
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json(
      { error: "Error al buscar productos" },
      { status: 500 }
    );
  }
}
