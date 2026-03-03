import { NextRequest } from "next/server";
import * as XLSX from "xlsx";

type Product = { name: string; expiry_date: string };

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function toYYYYMMDD(value: unknown): string | null {
  if (typeof value === "string" && DATE_REGEX.test(value)) return value;
  if (typeof value === "number" && !isNaN(value)) {
    const d = new Date((value - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

function parseName(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return Response.json(
        { error: "No file provided. Use form field 'file'." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return Response.json({ error: "Empty workbook" }, { status: 400 });
    }
    const ws = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    const products: Product[] = [];
    const errors: string[] = [];

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      const name =
        parseName(
          row.name ?? row.nombre ?? row.Name ?? row.Nombre ?? row["Nombre"]
        ) || parseName(row["Producto"]) || parseName(row.producto);
      const dateRaw =
        row.expiry_date ??
        row.vencimiento ??
        row["expiry_date"] ??
        row["Vencimiento"] ??
        row.fecha ??
        row.Fecha;
      const expiry_date = toYYYYMMDD(dateRaw);

      if (!name) {
        errors.push(`Fila ${i + 2}: nombre vacío, se omite.`);
        continue;
      }
      if (!expiry_date) {
        errors.push(`Fila ${i + 2}: fecha inválida o faltante (use YYYY-MM-DD).`);
        continue;
      }
      products.push({ name, expiry_date });
    }

    return Response.json({
      products,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    console.error("Import error:", err);
    return Response.json(
      { error: "Error al procesar el archivo. Asegúrese de enviar un Excel válido." },
      { status: 500 }
    );
  }
}
