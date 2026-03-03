import { promises as fs } from "fs";

const LOG_PREFIX = "[template]";

const TEMPLATE_JSON = JSON.stringify(
  [{ name: "", expiry_date: "YYYY-MM-DD" }],
  null,
  2
);

export async function GET() {
  try {
    console.log(LOG_PREFIX, "Request received");
    const path = process.cwd() + "/public/template-products.json";
    const body = await fs.readFile(path, "utf-8").catch((err) => {
      console.warn(LOG_PREFIX, "Could not read template file, using default:", err?.message);
      return TEMPLATE_JSON;
    });
    console.log(LOG_PREFIX, "Serving template, length:", body.length);
    return new Response(body, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="products-template.json"',
      },
    });
  } catch (err) {
    console.error(LOG_PREFIX, "Unexpected error:", err);
    return new Response(TEMPLATE_JSON, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="products-template.json"',
      },
    });
  }
}
