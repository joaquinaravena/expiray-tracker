-- Vencimientos schema: products + vencimientos, vencidos, fallados
-- Run in Neon SQL Editor or: psql $DATABASE_URL -f scripts/init-schema.sql

-- 1. products: central product identity (producto/articulo)
CREATE TABLE IF NOT EXISTS products (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  articulo   text,
  created_at timestamptz DEFAULT now()
);

-- Add articulo if table already existed without it (run once if needed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'articulo') THEN
    ALTER TABLE products ADD COLUMN articulo text;
  END IF;
END $$;

-- 2. vencimientos: product expiry dates and category
CREATE TABLE IF NOT EXISTS vencimientos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  expiry_date date NOT NULL,
  category    text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vencimientos_product_id ON vencimientos(product_id);
CREATE INDEX IF NOT EXISTS idx_vencimientos_expiry_date ON vencimientos(expiry_date);

-- 3. vencidos: expired items with stock (nombre = product name from products)
CREATE TABLE IF NOT EXISTS vencidos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  expiry_date date,
  stock       int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vencidos_product_id ON vencidos(product_id);

-- Drop description if it existed (migration)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vencidos' AND column_name = 'description') THEN
    ALTER TABLE vencidos DROP COLUMN description;
  END IF;
END $$;

-- 4. fallados: failed items with stock (nombre = product name from products)
CREATE TABLE IF NOT EXISTS fallados (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock       int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fallados_product_id ON fallados(product_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fallados' AND column_name = 'description') THEN
    ALTER TABLE fallados DROP COLUMN description;
  END IF;
END $$;

-- 5. push_subscriptions: Web Push subscriptions (one per browser/device)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint  text NOT NULL UNIQUE,
  p256dh    text NOT NULL,
  auth      text NOT NULL,
  created_at timestamptz DEFAULT now()
);
