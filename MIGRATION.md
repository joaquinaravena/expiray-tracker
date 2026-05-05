# Migrar datos a la base de datos

1. **Schema**: Ejecuta `scripts/init-schema.sql` en el Neon SQL Editor (solo una vez, o de nuevo si añadiste columnas; el script quita la columna `description` de `vencidos` y `fallados` si existía y crea la tabla `push_subscriptions` para Web Push).
2. El script también crea el catálogo fijo de sucursales (`don-bosco`, `alem`), agrega `branch_id` en `vencimientos`, `vencidos` y `fallados`, y asigna todo el legado a `don-bosco`.
3. La API acepta solo esas dos sucursales con `?branch=don-bosco|alem` (default: `don-bosco`).

4. A partir de ahí, el dashboard y el cron usan solo la base de datos.
