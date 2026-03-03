/**
 * Convierte un Excel con 3 secciones (VENCIMIENTOS, VENCIDOS, FALLADOS) a public/data/tracker.json.
 * Fila 1: títulos de sección. Fila 2: encabezados de columnas. Fila 3+: datos.
 * Uso: node convert.js [ruta/al/archivo.xlsx]
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2] || "products.xlsx";
const outputPath = path.join(__dirname, "public", "data", "tracker.json");

if (!fs.existsSync(inputFile)) {
  console.error("No se encontró el archivo:", inputFile);
  console.error("Uso: node convert.js [ruta/al/archivo.xlsx]");
  process.exit(1);
}

function str(val) {
  if (val == null) return "";
  return String(val).trim();
}

function num(val) {
  if (val == null || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function toYYYYMMDD(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;
  if (typeof value === "string") {
    const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const [, d, mo, y] = m;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  if (typeof value === "number" && !isNaN(value)) {
    const d = new Date((value - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (value instanceof Date && !isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  return null;
}

function findSectionCol(row, title) {
  const upper = title.toUpperCase();
  for (let c = 0; c < row.length; c++) {
    if (str(row[c]).toUpperCase() === upper) return c;
  }
  return -1;
}

function findHeaderCol(row, startCol, endCol, names) {
  const range = endCol <= startCol ? row.length : endCol;
  for (let c = startCol; c < range; c++) {
    const cell = str(row[c]).toUpperCase().replace(/\s+/g, " ");
    for (const name of names) {
      if (cell.includes(name.toUpperCase().replace(/\s+/g, " "))) return c;
    }
  }
  return -1;
}

function findHeaderRowIndex(rawRows, vencimientosStart, vencidosStart, falladosStart) {
  function nextAfter(start) {
    const candidates = [vencimientosStart, vencidosStart, falladosStart].filter((c) => c > start);
    return candidates.length ? Math.min(...candidates) : start + 10;
  }
  const end = nextAfter(vencimientosStart);
  for (let r = 1; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r] || [];
    if (findHeaderCol(row, vencimientosStart, end, ["PRODUCTO", "VENCIMIENTO"]) >= 0) return r;
  }
  return 1;
}

const wb = XLSX.readFile(inputFile);
const ws = wb.Sheets[wb.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

if (!Array.isArray(rawRows) || rawRows.length < 2) {
  console.error("La hoja debe tener al menos fila de títulos y encabezados.");
  process.exit(1);
}

const row0 = rawRows[0];
const vencimientosStart = findSectionCol(row0, "VENCIMIENTOS");
const vencidosStart = findSectionCol(row0, "VENCIDOS");
const falladosStart = findSectionCol(row0, "FALLADOS");

function nextAfter(start) {
  const candidates = [vencimientosStart, vencidosStart, falladosStart].filter(
    (c) => c > start,
  );
  return candidates.length ? Math.min(...candidates) : start + 10;
}

const headerRowIndex = findHeaderRowIndex(rawRows, vencimientosStart, vencidosStart, falladosStart);
const headerRow = rawRows[headerRowIndex] || [];
const dataStartRow = headerRowIndex + 1;
console.log("Encabezados en fila", headerRowIndex + 1, ", datos desde fila", dataStartRow + 1);

const vencimientos = [];
const vencidos = [];
const fallados = [];

if (vencimientosStart >= 0) {
  const end = nextAfter(vencimientosStart);
  const colProducto = findHeaderCol(headerRow, vencimientosStart, end, ["PRODUCTO"]);
  const colVencimiento = findHeaderCol(headerRow, vencimientosStart, end, [
    "VENCIMIENTO",
  ]);
  const colCategoria = findHeaderCol(headerRow, vencimientosStart, end, [
    "CATEGORIA",
    "CATEGORÍA",
  ]);
  for (let r = dataStartRow; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const producto = colProducto >= 0 ? str(row[colProducto]) : "";
    const vencimiento =
      colVencimiento >= 0 ? toYYYYMMDD(row[colVencimiento]) : null;
    const categoria = colCategoria >= 0 ? str(row[colCategoria]) : "";
    if (!producto && !vencimiento && !categoria) continue;
    if (!producto || !vencimiento) continue;
    vencimientos.push({ producto, vencimiento, categoria });
  }
}

if (vencidosStart >= 0) {
  const end = nextAfter(vencidosStart);
  const colArticulo = findHeaderCol(headerRow, vencidosStart, end, [
    "ARTICULO",
    "ARTÍCULO",
  ]);
  const colDescripcion = findHeaderCol(headerRow, vencidosStart, end, [
    "DESCRIPCION",
    "DESCRIPCIÓN",
  ]);
  const colFecha = findHeaderCol(headerRow, vencidosStart, end, [
    "FECHA VENCI",
    "FECHA_VENCI",
    "FECHA VENCIMIENTO",
  ]);
  const colCant = findHeaderCol(headerRow, vencidosStart, end, ["CANT"]);
  for (let r = dataStartRow; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const articulo = colArticulo >= 0 ? str(row[colArticulo]) : "";
    const descripcion = colDescripcion >= 0 ? str(row[colDescripcion]) : "";
    const fecha_venci = colFecha >= 0 ? toYYYYMMDD(row[colFecha]) : null;
    const cant = colCant >= 0 ? num(row[colCant]) : 0;
    if (!articulo && !descripcion && !fecha_venci && cant === 0) continue;
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
  const colArticulo = findHeaderCol(headerRow, falladosStart, end, [
    "ARTICULO",
    "ARTÍCULO",
  ]);
  const colDescripcion = findHeaderCol(headerRow, falladosStart, end, [
    "DESCRIPCION",
    "DESCRIPCIÓN",
  ]);
  const colCant = findHeaderCol(headerRow, falladosStart, end, ["CANT"]);
  for (let r = dataStartRow; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const articulo = colArticulo >= 0 ? str(row[colArticulo]) : "";
    const descripcion = colDescripcion >= 0 ? str(row[colDescripcion]) : "";
    const cant = colCant >= 0 ? num(row[colCant]) : 0;
    if (!articulo && !descripcion && cant === 0) continue;
    fallados.push({ articulo, descripcion, cant });
  }
}

const tracker = { vencimientos, vencidos, fallados };
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(tracker, null, 2), "utf-8");
console.log(
  "tracker.json generado en",
  outputPath,
  "| vencimientos:",
  vencimientos.length,
  "vencidos:",
  vencidos.length,
  "fallados:",
  fallados.length,
);
