import { promises as fs } from "fs";

const TEMPLATE_JSON = JSON.stringify(
  [{ name: "", expiry_date: "YYYY-MM-DD" }],
  null,
 2
);

export async function GET() {
  try {
    const path = process.cwd() + "/public/template-products.json";
    const body = await fs.readFile(path, "utf-8").catch(() => TEMPLATE_JSON);
    return new Response(body, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="products-template.json"',
      },
    });
  } catch {
    return new Response(TEMPLATE_JSON, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="products-template.json"',
      },
    });
  }
}
