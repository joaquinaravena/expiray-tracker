import { sql, queryOne } from "@/lib/db";
import type {
  Vencimiento,
  Vencido,
  Fallado,
  ProductRow,
  VencimientoRow,
  VencidoRow,
  FalladoRow,
} from "@/lib/utils";

// ----- Products -----

export async function findOrCreateProductByName(
  name: string,
  articulo?: string | null
): Promise<ProductRow> {
  const trimmed = name.trim();
  const art = articulo != null ? String(articulo).trim() || null : null;
  const existing = await sql`
    SELECT id, name, articulo, created_at FROM products WHERE name = ${trimmed} LIMIT 1
  `;
  const row = queryOne(existing as ProductRow[]);
  if (row) {
    if (art !== null && row.articulo !== art) {
      await sql`UPDATE products SET articulo = ${art} WHERE id = ${row.id}`;
      return { ...row, articulo: art };
    }
    return row;
  }
  const inserted = await sql`
    INSERT INTO products (name, articulo) VALUES (${trimmed}, ${art})
    RETURNING id, name, articulo, created_at
  `;
  const created = queryOne(inserted as ProductRow[]);
  if (!created) throw new Error("Failed to create product");
  return created;
}

export async function updateProductArticulo(productId: string, articulo: string | null): Promise<void> {
  await sql`UPDATE products SET articulo = ${articulo} WHERE id = ${productId}`;
}

export async function updateProductName(productId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await sql`UPDATE products SET name = ${trimmed} WHERE id = ${productId}`;
}

export async function searchProducts(q: string, limit = 20): Promise<ProductRow[]> {
  const raw = String(q).trim();
  if (!raw) return [];
  const term = `%${raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const rows = await sql`
    SELECT id, name, articulo, created_at FROM products
    WHERE name ILIKE ${term} OR (articulo IS NOT NULL AND articulo ILIKE ${term})
    ORDER BY name ASC
    LIMIT ${limit}
  `;
  return (rows as ProductRow[]) || [];
}

// ----- Vencimientos -----

function mapVencimientoRow(r: VencimientoRow & { product_name?: string; product_articulo?: string | null }): Vencimiento {
  return {
    id: r.id,
    product_id: r.product_id,
    producto: r.product_name ?? "",
    articulo: r.product_articulo ?? "",
    vencimiento: r.expiry_date,
    categoria: r.category ?? "",
  };
}

/** All products with their soonest expiry (one row per product). Products without vencimiento have null expiry and appear at the end. */
export async function getAllVencimientos(): Promise<Vencimiento[]> {
  const rows = await sql`
    SELECT
      v.id,
      p.id AS product_id,
      v.expiry_date,
      v.category,
      p.name AS product_name,
      p.articulo AS product_articulo
    FROM products p
    LEFT JOIN LATERAL (
      SELECT id, product_id, expiry_date, category
      FROM vencimientos
      WHERE product_id = p.id
      ORDER BY expiry_date ASC
      LIMIT 1
    ) v ON true
    ORDER BY v.expiry_date ASC NULLS LAST, p.name ASC
  `;
  return (rows as (VencimientoRow & { product_name: string; product_articulo?: string | null })[]).map((r) => ({
    id: r.id ?? undefined,
    product_id: r.product_id,
    producto: r.product_name ?? "",
    articulo: r.product_articulo ?? "",
    vencimiento: r.expiry_date ?? "",
    categoria: r.category ?? "",
  }));
}

export async function getVencimientoById(id: string): Promise<Vencimiento | null> {
  const rows = await sql`
    SELECT v.id, v.product_id, v.expiry_date, v.category, v.created_at, p.name AS product_name, p.articulo AS product_articulo
    FROM vencimientos v
    JOIN products p ON p.id = v.product_id
    WHERE v.id = ${id}
    LIMIT 1
  `;
  const row = queryOne(rows as (VencimientoRow & { product_name: string; product_articulo?: string | null })[]);
  return row ? mapVencimientoRow(row) : null;
}

export async function createVencimiento(args: {
  productName: string;
  articulo?: string | null;
  expiry_date: string;
  category?: string | null;
}): Promise<Vencimiento> {
  const product = await findOrCreateProductByName(args.productName, args.articulo);
  const inserted = await sql`
    INSERT INTO vencimientos (product_id, expiry_date, category)
    VALUES (${product.id}, ${args.expiry_date}, ${args.category ?? null})
    RETURNING id, product_id, expiry_date, category, created_at
  `;
  const row = queryOne(inserted as VencimientoRow[]);
  if (!row) throw new Error("Failed to create vencimiento");
  return mapVencimientoRow({ ...row, product_name: product.name, product_articulo: product.articulo ?? null });
}

export async function updateVencimiento(
  id: string,
  args: { expiry_date?: string; category?: string | null }
): Promise<Vencimiento | null> {
  if (args.expiry_date !== undefined) {
    await sql`UPDATE vencimientos SET expiry_date = ${args.expiry_date} WHERE id = ${id}`;
  }
  if (args.category !== undefined) {
    await sql`UPDATE vencimientos SET category = ${args.category} WHERE id = ${id}`;
  }
  return getVencimientoById(id);
}

export async function deleteVencimiento(id: string): Promise<boolean> {
  const result = await sql`DELETE FROM vencimientos WHERE id = ${id} RETURNING id`;
  return Array.isArray(result) && result.length > 0;
}

// ----- Vencidos -----

function mapVencidoRow(r: VencidoRow & { product_name?: string; product_articulo?: string | null }): Vencido {
  return {
    id: r.id,
    product_id: r.product_id,
    articulo: r.product_articulo ?? "",
    nombre: r.product_name ?? "",
    fecha_venci: r.expiry_date ?? "",
    cant: r.stock,
  };
}

export async function getAllVencidos(): Promise<Vencido[]> {
  const rows = await sql`
    SELECT v.id, v.product_id, v.expiry_date, v.stock, v.created_at, p.name AS product_name, p.articulo AS product_articulo
    FROM vencidos v
    JOIN products p ON p.id = v.product_id
    ORDER BY p.name ASC
  `;
  return (rows as (VencidoRow & { product_name: string; product_articulo?: string | null })[]).map(mapVencidoRow);
}

export async function getVencidoById(id: string): Promise<Vencido | null> {
  const rows = await sql`
    SELECT v.id, v.product_id, v.expiry_date, v.stock, v.created_at, p.name AS product_name, p.articulo AS product_articulo
    FROM vencidos v
    JOIN products p ON p.id = v.product_id
    WHERE v.id = ${id}
    LIMIT 1
  `;
  const row = queryOne(rows as (VencidoRow & { product_name: string; product_articulo?: string | null })[]);
  return row ? mapVencidoRow(row) : null;
}

export async function createVencido(args: {
  productName: string;
  articulo?: string | null;
  expiry_date?: string | null;
  stock?: number;
}): Promise<Vencido> {
  const product = await findOrCreateProductByName(args.productName, args.articulo);
  const stock = args.stock ?? 0;
  const inserted = await sql`
    INSERT INTO vencidos (product_id, expiry_date, stock)
    VALUES (${product.id}, ${args.expiry_date ?? null}, ${stock})
    RETURNING id, product_id, expiry_date, stock, created_at
  `;
  const row = queryOne(inserted as VencidoRow[]);
  if (!row) throw new Error("Failed to create vencido");
  return mapVencidoRow({ ...row, product_name: product.name, product_articulo: product.articulo ?? null });
}

export async function updateVencido(
  id: string,
  args: { expiry_date?: string | null; stock?: number }
): Promise<Vencido | null> {
  if (args.expiry_date !== undefined) {
    await sql`UPDATE vencidos SET expiry_date = ${args.expiry_date} WHERE id = ${id}`;
  }
  if (args.stock !== undefined) {
    await sql`UPDATE vencidos SET stock = ${args.stock} WHERE id = ${id}`;
  }
  return getVencidoById(id);
}

export async function deleteVencido(id: string): Promise<boolean> {
  const result = await sql`DELETE FROM vencidos WHERE id = ${id} RETURNING id`;
  return Array.isArray(result) && result.length > 0;
}

// ----- Fallados -----

function mapFalladoRow(r: FalladoRow & { product_name?: string; product_articulo?: string | null }): Fallado {
  return {
    id: r.id,
    product_id: r.product_id,
    articulo: r.product_articulo ?? "",
    nombre: r.product_name ?? "",
    cant: r.stock,
  };
}

export async function getAllFallados(): Promise<Fallado[]> {
  const rows = await sql`
    SELECT f.id, f.product_id, f.stock, f.created_at, p.name AS product_name, p.articulo AS product_articulo
    FROM fallados f
    JOIN products p ON p.id = f.product_id
    ORDER BY p.name ASC
  `;
  return (rows as (FalladoRow & { product_name: string; product_articulo?: string | null })[]).map(mapFalladoRow);
}

export async function getFalladoById(id: string): Promise<Fallado | null> {
  const rows = await sql`
    SELECT f.id, f.product_id, f.stock, f.created_at, p.name AS product_name, p.articulo AS product_articulo
    FROM fallados f
    JOIN products p ON p.id = f.product_id
    WHERE f.id = ${id}
    LIMIT 1
  `;
  const row = queryOne(rows as (FalladoRow & { product_name: string; product_articulo?: string | null })[]);
  return row ? mapFalladoRow(row) : null;
}

export async function createFallado(args: {
  productName: string;
  articulo?: string | null;
  stock?: number;
}): Promise<Fallado> {
  const product = await findOrCreateProductByName(args.productName, args.articulo);
  const stock = args.stock ?? 0;
  const inserted = await sql`
    INSERT INTO fallados (product_id, stock)
    VALUES (${product.id}, ${stock})
    RETURNING id, product_id, stock, created_at
  `;
  const row = queryOne(inserted as FalladoRow[]);
  if (!row) throw new Error("Failed to create fallado");
  return mapFalladoRow({ ...row, product_name: product.name, product_articulo: product.articulo ?? null });
}

export async function updateFallado(
  id: string,
  args: { stock?: number }
): Promise<Fallado | null> {
  if (args.stock !== undefined) {
    await sql`UPDATE fallados SET stock = ${args.stock} WHERE id = ${id}`;
  }
  return getFalladoById(id);
}

export async function deleteFallado(id: string): Promise<boolean> {
  const result = await sql`DELETE FROM fallados WHERE id = ${id} RETURNING id`;
  return Array.isArray(result) && result.length > 0;
}

// ----- Push subscriptions (Web Push) -----

export type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at?: string;
};

export async function getAllPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  const rows = await sql`
    SELECT id, endpoint, p256dh, auth, created_at FROM push_subscriptions
  `;
  return (rows as PushSubscriptionRow[]) || [];
}

export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  await sql`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth)
    VALUES (${sub.endpoint}, ${sub.p256dh}, ${sub.auth})
    ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
  `;
}
