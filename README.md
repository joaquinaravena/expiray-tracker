# Expiry Tracker Static

App Next.js para seguir vencimientos de productos **sin base de datos**. Los datos viven en un JSON estático. Incluye cron en Vercel que envía alertas por email (Resend) cuando un producto vence en 3 días o menos.

## Stack

- **Next.js** (App Router), **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Resend**, **Vercel Cron**
- Datos: `public/data/tracker.json` con tres listas: `vencimientos`, `vencidos`, `fallados`.

## Requisitos

- Node 18+
- npm o pnpm

## Variables de entorno

Copia `.env.example` a `.env` y rellena:

| Variable        | Descripción                          |
|----------------|--------------------------------------|
| `RESEND_API_KEY` | API key de [Resend](https://resend.com) |
| `TO_EMAIL`       | Email donde recibir alertas (ej. `tuemail@gmail.com`) |
| `CRON_SECRET`    | (Opcional) Secreto para proteger `/api/cron`; en Vercel se envía como `Authorization: Bearer <CRON_SECRET>`. |

## Cómo convertir Excel a JSON

El Excel debe tener **una hoja con 3 secciones en paralelo** (fila 1 = títulos, fila 2 = encabezados, fila 3+ = datos):

- **VENCIMIENTOS**: columnas PRODUCTO, VENCIMIENTO, CATEGORIA
- **VENCIDOS**: columnas ARTICULO, DESCRIPCION, FECHA VENCI, CANT
- **FALLADOS**: columnas ARTICULO, DESCRIPCION, CANT

1. Coloca el archivo en la raíz del proyecto (o pasa la ruta como argumento).

2. Ejecuta:

   ```bash
   node convert.js
   # o: node convert.js ruta/a/mi-archivo.xlsx
   ```

3. Se generará `public/data/tracker.json`. Para producción: reemplaza ese archivo y redespliega (o sube el Excel en la app y descarga el JSON).

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). El dashboard muestra tres pestañas: **Vencimientos** (con días restantes en rojo si &lt; 3), **Vencidos** y **Fallados (solo vista)**.

- **Cargar Excel**: sube un `.xlsx` con las 3 secciones; se muestra el resultado y puedes **Descargar tracker.json** para reemplazar `public/data/tracker.json` y redesplegar.
- **Recargar**: vuelve a cargar los datos desde `public/data/tracker.json`.

## Deploy en Vercel

1. Conecta el repositorio a Vercel y despliega.
2. En el proyecto de Vercel, **Settings → Environment Variables**, añade:
   - `RESEND_API_KEY`
   - `TO_EMAIL`
   - (Opcional) `CRON_SECRET` (y configúralo también en la ruta `/api/cron` si la proteges con este secreto).
3. El **cron** está definido en `vercel.json`: se ejecuta a las **09:00 UTC** y llama a `GET /api/cron`. Lee `public/data/tracker.json`, filtra ítems de `vencimientos` que vencen en 3 días o menos, y envía un email por cada uno vía Resend.

## Sin base de datos ni auth

- No hay base de datos: la fuente de verdad es `public/data/tracker.json`.
- Para actualizar en producción: sube el Excel en la app, descarga `tracker.json`, reemplázalo en el repo y redespliega (o usa `node convert.js` localmente).

## Estructura relevante

- `app/page.tsx` – Dashboard con pestañas y botones Cargar Excel / Descargar tracker.json / Recargar.
- `app/api/cron/route.ts` – GET; lee `tracker.json`, filtra `vencimientos` por vencimiento ≤ 3 días, envía emails Resend.
- `app/api/import/route.ts` – POST; recibe Excel, parsea las 3 secciones, devuelve `{ data: TrackerData }`.
- `lib/utils.ts` – Tipos `Vencimiento`, `Vencido`, `Fallado`, `TrackerData`; helpers `formatExpiryDate`, `getDaysRemaining`.
- `components/TrackerTables.tsx` – Tres tablas en pestañas (Vencimientos, Vencidos, Fallados).
- `convert.js` – Script Node para convertir Excel de 3 secciones → `public/data/tracker.json`.
