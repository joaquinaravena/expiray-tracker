/**
 * Convierte un Excel (products.xlsx) a public/data/products.json.
 * Columnas esperadas: "name" o "nombre", "expiry_date" o "vencimiento" (YYYY-MM-DD o fecha Excel).
 * Uso: node convert.js
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2] || "products.xlsx";
const outputPath = path.join(__dirname, "public", "data", "products.json");

if (!fs.existsSync(inputFile)) {
  console.error("No se encontró el archivo:", inputFile);
  console.error("Uso: node convert.js [ruta/al/archivo.xlsx]");
  process.exit(1);
}

const wb = XLSX.readFile(inputFile);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: "yyyy-mm-dd" });

function toYYYYMMDD(val) {
  if (val == null || val === "") return null;
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (typeof val === "number" && !isNaN(val)) {
    const d = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime()))
      return d.toISOString().slice(0, 10);
  }
  if (val instanceof Date && !isNaN(val.getTime()))
    return val.toISOString().slice(0, 10);
  return null;
}

function getStr(row, ...keys) {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

const products = data
  .map((row) => {
    const name = getStr(row, "name", "nombre", "Name", "Nombre", "Producto", "producto");
    const dateRaw = row.expiry_date ?? row.vencimiento ?? row.Vencimiento ?? row.fecha ?? row.Fecha;
    const expiry_date = toYYYYMMDD(dateRaw) || (typeof dateRaw === "string" ? dateRaw : null);
    return { name, expiry_date };
  })
  .filter((p) => p.name && p.expiry_date);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(products, null, 2), "utf-8");
console.log("JSON generado en", outputPath, "(" + products.length + " productos).");
