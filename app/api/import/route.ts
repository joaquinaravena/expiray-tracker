import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import type { TrackerData, Vencimiento, Vencido, Fallado } from "@/lib/utils";

const LOG_PREFIX = "[import]";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DDMMYYYY_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function toYYYYMMDD(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string" && DATE_REGEX.test(value)) return value;
  if (typeof value === "string") {
    const m = value.trim().match(DDMMYYYY_REGEX);
    if (m) {
      const [, d, mo, y] = m;
      const day = d!.padStart(2, "0");
      const month = mo!.padStart(2, "0");
      return `${y}-${month}-${day}`;
    }
  }
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

function str(val: unknown): string {
  if (val == null) return "";
  return String(val).trim();
}

function num(val: unknown): number {
  if (val == null || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function findSectionCol(row: unknown[], title: string): number {
  const upper = title.toUpperCase();
  for (let c = 0; c < row.length; c++) {
    if (str(row[c]).toUpperCase() === upper) return c;
  }
  return -1;
}

function findHeaderCol(row: unknown[], startCol: number, endCol: number, names: string[]): number {
  const range = endCol <= startCol ? row.length : endCol;
  for (let c = startCol; c < range; c++) {
    const cell = str(row[c]).toUpperCase().replace(/\s+/g, " ");
    for (const name of names) {
      if (cell.includes(name.toUpperCase().replace(/\s+/g, " "))) return c;
    }
  }
  return -1;
}

/** Find the row index that contains column headers (PRODUCTO, VENCIMIENTO, etc.). Handles empty rows between title row and headers. */
function findHeaderRowIndex(
  rawRows: unknown[][],
  row0: unknown[],
  vencimientosStart: number,
  vencidosStart: number,
  falladosStart: number,
): number {
  const nextAfter = (start: number) => {
    const candidates = [vencimientosStart, vencidosStart, falladosStart].filter((c) => c > start);
    return candidates.length ? Math.min(...candidates) : start + 10;
  };
  const end = nextAfter(vencimientosStart);
  for (let r = 1; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r] as unknown[] | undefined;
    if (!row) continue;
    if (findHeaderCol(row, vencimientosStart, end, ["PRODUCTO", "VENCIMIENTO"]) >= 0) {
      return r;
    }
  }
  return 1;
}

export async function POST(request: NextRequest) {
  try {
    console.log(LOG_PREFIX, "Request received");
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      console.error(LOG_PREFIX, "No file in formData; expected field 'file'");
      return Response.json(
        { error: "No file provided. Use form field 'file'." },
        { status: 400 }
      );
    }
    console.log(LOG_PREFIX, "File:", file.name, "size:", file.size);

    const buffer = Buffer.from(await file.arrayBuffer());
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(buffer, { type: "buffer" });
    } catch (parseErr) {
      console.error(LOG_PREFIX, "XLSX read failed:", parseErr);
      return Response.json(
        { error: "Archivo no es un Excel válido." },
        { status: 400 }
      );
    }
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      console.error(LOG_PREFIX, "Workbook has no sheets");
      return Response.json({ error: "Empty workbook" }, { status: 400 });
    }
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
    if (!Array.isArray(rawRows) || rawRows.length < 2) {
      console.error(LOG_PREFIX, "Sheet has fewer than 2 rows");
      return Response.json(
        { error: "La hoja debe tener al menos fila de títulos y encabezados." },
        { status: 400 }
      );
    }

    const row0 = rawRows[0] as unknown[];
    const vencimientosStart = findSectionCol(row0, "VENCIMIENTOS");
    const vencidosStart = findSectionCol(row0, "VENCIDOS");
    const falladosStart = findSectionCol(row0, "FALLADOS");

    const warnings: string[] = [];
    if (vencimientosStart < 0) warnings.push("No se encontró sección 'VENCIMIENTOS' en la fila 1.");
    if (vencidosStart < 0) warnings.push("No se encontró sección 'VENCIDOS' en la fila 1.");
    if (falladosStart < 0) warnings.push("No se encontró sección 'FALLADOS' en la fila 1.");

    const nextAfter = (start: number) => {
      const candidates = [vencimientosStart, vencidosStart, falladosStart].filter((c) => c > start);
      return candidates.length ? Math.min(...candidates) : start + 10;
    };

    const headerRowIndex = findHeaderRowIndex(rawRows, row0, vencimientosStart, vencidosStart, falladosStart);
    const headerRow = rawRows[headerRowIndex] as unknown[];
    const dataStartRow = headerRowIndex + 1;
    console.log(LOG_PREFIX, "Section titles row 0, header row", headerRowIndex + 1, ", data from row", dataStartRow + 1);

    const vencimientos: Vencimiento[] = [];
    const vencidos: Vencido[] = [];
    const fallados: Fallado[] = [];

    if (vencimientosStart >= 0) {
      const end = nextAfter(vencimientosStart);
      const colProducto = findHeaderCol(headerRow, vencimientosStart, end, ["PRODUCTO"]);
      const colVencimiento = findHeaderCol(headerRow, vencimientosStart, end, ["VENCIMIENTO"]);
      const colCategoria = findHeaderCol(headerRow, vencimientosStart, end, ["CATEGORIA", "CATEGORÍA"]);
      for (let r = dataStartRow; r < rawRows.length; r++) {
        const row = rawRows[r] as unknown[] | undefined;
        if (!row) continue;
        const producto = colProducto >= 0 ? str(row[colProducto]) : "";
        const vencimiento = colVencimiento >= 0 ? toYYYYMMDD(row[colVencimiento]) : null;
        const categoria = colCategoria >= 0 ? str(row[colCategoria]) : "";
        const empty = !producto && !vencimiento && !categoria;
        if (empty) continue;
        if (!producto) {
          warnings.push(`VENCIMIENTOS fila ${r + 1}: producto vacío, se omite.`);
          continue;
        }
        if (!vencimiento) {
          warnings.push(`VENCIMIENTOS fila ${r + 1}: fecha inválida o faltante.`);
          continue;
        }
        vencimientos.push({ producto, vencimiento, categoria });
      }
    }

    if (vencidosStart >= 0) {
      const end = nextAfter(vencidosStart);
      const colArticulo = findHeaderCol(headerRow, vencidosStart, end, ["ARTICULO", "ARTÍCULO"]);
      const colDescripcion = findHeaderCol(headerRow, vencidosStart, end, ["DESCRIPCION", "DESCRIPCIÓN"]);
      const colFecha = findHeaderCol(headerRow, vencidosStart, end, ["FECHA VENCI", "FECHA_VENCI", "FECHA VENCIMIENTO"]);
      const colCant = findHeaderCol(headerRow, vencidosStart, end, ["CANT"]);
      for (let r = dataStartRow; r < rawRows.length; r++) {
        const row = rawRows[r] as unknown[] | undefined;
        if (!row) continue;
        const articulo = colArticulo >= 0 ? str(row[colArticulo]) : "";
        const descripcion = colDescripcion >= 0 ? str(row[colDescripcion]) : "";
        const fecha_venci = colFecha >= 0 ? toYYYYMMDD(row[colFecha]) : null;
        const cant = colCant >= 0 ? num(row[colCant]) : 0;
        const empty = !articulo && !descripcion && !fecha_venci && cant === 0;
        if (empty) continue;
        vencidos.push({
          articulo,
          descripcion,
          fecha_venci: fecha_venci || "",
          cant,
        });
      }
    }

    if (falladosStart >= 0) {
      const end = nextAfter(falladosStart);
      const colArticulo = findHeaderCol(headerRow, falladosStart, end, ["ARTICULO", "ARTÍCULO"]);
      const colDescripcion = findHeaderCol(headerRow, falladosStart, end, ["DESCRIPCION", "DESCRIPCIÓN"]);
      const colCant = findHeaderCol(headerRow, falladosStart, end, ["CANT"]);
      for (let r = dataStartRow; r < rawRows.length; r++) {
        const row = rawRows[r] as unknown[] | undefined;
        if (!row) continue;
        const articulo = colArticulo >= 0 ? str(row[colArticulo]) : "";
        const descripcion = colDescripcion >= 0 ? str(row[colDescripcion]) : "";
        const cant = colCant >= 0 ? num(row[colCant]) : 0;
        const empty = !articulo && !descripcion && cant === 0;
        if (empty) continue;
        fallados.push({ articulo, descripcion, cant });
      }
    }

    const data: TrackerData = { vencimientos, vencidos, fallados };
    console.log(
      LOG_PREFIX,
      "Success. vencimientos:",
      vencimientos.length,
      "vencidos:",
      vencidos.length,
      "fallados:",
      fallados.length,
      "warnings:",
      warnings.length
    );
    warnings.forEach((e) => console.warn(LOG_PREFIX, e));
    return Response.json({ data, warnings: warnings.length ? warnings : undefined });
  } catch (err) {
    console.error(LOG_PREFIX, "Unexpected error:", err);
    return Response.json(
      { error: "Error al procesar el archivo. Asegúrese de enviar un Excel válido." },
      { status: 500 }
    );
  }
}
