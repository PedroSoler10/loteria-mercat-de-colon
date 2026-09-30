@AGENTS.md

# Lotería Mercat de Colón

Aplicación web local (100 % sin conexión) para gestionar albaranes, inventario, ventas en el TPV, cedidos y análisis de una administración de lotería. Stack: Next.js 16, React 19, TypeScript, Tailwind 4, Prisma 6 y SQLite. Más detalle en `README.md` y `docs/estructura-base-datos.md`; no lo repitas aquí.

## Idioma

Todo en español: respuestas, comentarios, mensajes de commit, textos de la interfaz y documentación. Los identificadores del esquema ya están en español (`Boleto`, `Venta`, `Cedido`), así que sigue esa convención.

## Comandos

Usa `pnpm` directamente (no `corepack pnpm`).

- `pnpm dev`: prepara la base de datos, aplica migraciones y arranca en http://localhost:3000.
- `pnpm build`: compila para producción.
- `pnpm exec tsc --noEmit --incremental false`: comprobación de tipos. Es imprescindible porque el build de Next.js **no** se bloquea por errores de TypeScript.
- `pnpm db:migrate`: crea una migración nueva a partir de cambios en `prisma/schema.prisma`.
- `pnpm sales:import -- "ruta\ventas.txt"`: importa ventas desde un `.txt`.

## Cómo verificar un cambio

No hay tests automáticos. Antes de dar un cambio por terminado:

1. Ejecuta la comprobación de tipos y el build.
2. Arranca la app con `pnpm dev` y prueba el flujo afectado en el navegador.

## Flujo de trabajo con Git

- Trabaja siempre en una **rama nueva**; no hagas commits directos en `main`.
- Pide confirmación antes de hacer commit o push, y muestra el diff antes.
- `next-env.d.ts` lo regenera Next.js automáticamente: no lo incluyas en los commits salvo que el cambio sea intencionado.

## Vocabulario del negocio

- **Boleto**: un décimo individual, identificado por sorteo, número, serie y fracción.
- **Origen**: procedencia de un alta de inventario (albarán en PDF, alta manual o lectura de códigos).
- **Cedido**: boleto que nuestra administración traspasa a otra lotería. Sale de nuestro inventario, pero **no cuenta como vendido**.
- **Venta**: salida de un único boleto por operación desde el TPV.
- Stock disponible = recibidos − cedidos − vendidos.

## Reglas que no se deducen del código

- Las migraciones ya aplicadas en `prisma/migrations` **no se modifican ni se borran**. Los cambios de esquema van siempre en una migración nueva.
- Las ventas anuladas se conservan y son reversibles (borrado lógico). No se eliminan físicamente salvo la acción explícita de borrado permanente.
- El precio pertenece al sorteo; la venta no lo puede modificar.
- `data/`, `*.db` y `.env` están en `.gitignore`. No subas bases de datos ni datos reales a Git.

## Base de datos

- Puedes modificar la base de datos local de desarrollo y ejecutar migraciones sobre ella.
- **Nunca** toques la base de datos que está cargada en Google Drive (la de producción): no la abras, modifiques ni sobrescribas. Si dudas de cuál es una base, pregunta antes.
- La ubicación por defecto en desarrollo es `%LOCALAPPDATA%\LoteriaMercatDeColon\data\loteria.db` (variable `LOTERIA_DATA_DIR`); `DATABASE_URL` en `.env` puede cambiarla.

## Estructura

```text
app/page.tsx        Estado y navegación principal (pestañas)
app/api/            Route Handlers: inventory, sales, cedidos, delivery-notes, manual-entry, origins, database
components/         Interfaz por pestaña: inventory/, record/, tpv/, analysis-tab.tsx; ui/ son piezas base
lib/                Lógica compartida (parser de albaranes PDF, códigos SELAE, datos de TPV y registro)
prisma/             Esquema y migraciones SQLite
scripts/            Arranque, importador de ventas y empaquetado para Windows
```

## Pendiente a corto plazo

- Mejorar la visualización de las últimas ventas en la pestaña TPV (`components/tpv/`, `lib/tpv-data.ts`).

## Entorno de desarrollo (Windows)

- Node.js ≥ 22 y pnpm 11 instalados; `corepack enable` requiere permisos de administrador.
- Si PowerShell bloquea scripts (`npm.ps1`, `pnpm.ps1`), hace falta `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
