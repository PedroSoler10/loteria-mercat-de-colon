# Lotería Mercat de Colón

Aplicación web de escritorio para gestionar el inventario y las ventas de una administración de lotería.

## Funcionalidades

- Gestión jerárquica del inventario por número, serie y fracción.
- Importación de albaranes y alta manual de décimos.
- Consulta de stock recibido, vendido y disponible.
- TPV para registrar ventas.
- Registro de ventas con arqueo por día, semana o mes.
- Edición y anulación de ventas.
- La pestaña Gráficas está preparada como sección futura.

## Tecnologías

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Lucide React
- pnpm mediante Corepack

## Requisitos

- Node.js
- Corepack

## Instalación

Desde la carpeta del proyecto, instala las dependencias:

```powershell
corepack pnpm install
```

## Ejecutar en desarrollo

```powershell
corepack pnpm dev
```

Después abre [http://localhost:3000](http://localhost:3000) en el navegador.

## Compilar para producción

```powershell
corepack pnpm build
corepack pnpm start
```

## Estructura del proyecto

```text
app/
  layout.tsx         Configuración global y metadatos
  page.tsx           Pantalla principal y navegación

components/
  inventory/         Inventario, importación y alta manual
  tpv/               Punto de venta y stock
  sales/             Arqueo e historial de ventas
  ui/                Componentes reutilizables

lib/
  inventory-data.ts  Tipos y datos del inventario
  sales-data.ts      Tipos y datos de ventas
  utils.ts           Utilidades comunes

public/              Recursos estáticos
```

## Uso

La aplicación comienza en la pestaña **TPV**. Desde la barra superior puedes cambiar entre:

- **Inventario**: consulta y organiza los décimos por número, serie y fracción.
- **TPV**: busca números, consulta la disponibilidad y registra ventas.
- **Registro de Ventas**: consulta el historial, revisa el arqueo y corrige o anula operaciones.
- **Gráficas**: sección reservada para futuras métricas visuales.

## Datos actuales

Los datos son de demostración y se mantienen en memoria durante la sesión. Se reinician al recargar la aplicación. Actualmente no hay una base de datos persistente.
