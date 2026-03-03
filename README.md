# Expiry Tracker Static

App Next.js para seguir vencimientos de productos **sin base de datos**. Los datos viven en un JSON estático. Incluye cron en Vercel que envía alertas por email (Resend) cuando un producto vence en 3 días o menos.

## Stack

- **Next.js** (App Router), **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Resend**, **Vercel Cron**
- Datos: `public/data/products.json` (array `[{ "name": string, "expiry_date": "YYYY-MM-DD" }]`)

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

1. Prepara un Excel (por ejemplo `products.xlsx`) con al menos dos columnas:
   - **Nombre del producto**: cabecera `name`, `nombre`, `Name` o `Nombre`
   - **Fecha de vencimiento**: cabecera `expiry_date`, `vencimiento` o `fecha`, en formato **YYYY-MM-DD** o fecha de Excel

2. Coloca el archivo en la raíz del proyecto (o pasa la ruta como argumento).

3. Ejecuta el script de conversión:

   ```bash
   node convert.js
   # o con ruta custom:
   node convert.js ruta/a/mi-archivo.xlsx
   ```

4. Se generará o actualizará `public/data/products.json` con el array de productos. Vuelve a desplegar (o recarga la app en local) para ver los cambios.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). El dashboard muestra la tabla de productos; los que tengan menos de 3 días hasta el vencimiento se muestran en rojo.

- **Actualizar Datos (template)**: descarga una plantilla JSON para rellenar y reemplazar `public/data/products.json`.
- **Vista previa Excel**: sube un `.xlsx` para ver el JSON parseado en pantalla (no se guarda; para aplicar cambios, usa el script `convert.js` y sustituye el JSON en `public/data/`).

## Deploy en Vercel

1. Conecta el repositorio a Vercel y despliega.
2. En el proyecto de Vercel, **Settings → Environment Variables**, añade:
   - `RESEND_API_KEY`
   - `TO_EMAIL`
   - (Opcional) `CRON_SECRET` (y configúralo también en la ruta `/api/cron` si la proteges con este secreto).
3. El **cron** está definido en `vercel.json`: se ejecuta a las **09:00 UTC** todos los días y llama a `GET /api/cron`. Ese endpoint lee `public/data/products.json`, filtra productos que vencen en 3 días o menos, y envía un email por cada uno vía Resend.

## Sin base de datos ni auth

- No hay base de datos: la única fuente de verdad es `public/data/products.json`.
- Para “actualizar” datos en producción: edita ese JSON (o regenera con `node convert.js` y sube el archivo) y vuelve a desplegar.

## Estructura relevante

- `app/page.tsx` – Dashboard con tabla y botones.
- `app/api/cron/route.ts` – GET; lee JSON, filtra por vencimiento ≤ 3 días, envía emails Resend.
- `app/api/import/route.ts` – POST; recibe Excel por `formData`, parsea con `xlsx`, devuelve JSON de vista previa (no escribe en disco).
- `lib/utils.ts` – Helpers de fecha: `formatExpiryDate`, `getDaysRemaining`.
- `components/DataTable.tsx` – Tabla de productos (nombre, fecha, días restantes).
- `convert.js` – Script Node para convertir Excel → `public/data/products.json`.
