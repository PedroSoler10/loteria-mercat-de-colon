# Lotería Mercat de Colón

Aplicación web de escritorio para gestionar el inventario y las ventas de una administración de lotería.

## Estado actual

La aplicación utiliza Next.js, una API backend y SQLite mediante Prisma. Los datos se conservan entre reinicios. Las migraciones se aplican automáticamente al arrancar con los scripts incluidos.

## Funcionalidades

- Gestión de boletos por número, serie y fracción.
- Consulta de boletos recibidos, vendidos y disponibles.
- Búsqueda de números por terminación o coincidencia parcial.
- Filtro de boletos disponibles.
- Venta manual desde la tabla de inventario.
- Venta rápida mediante lector de códigos o teclado.
- Selección del modo de venta: fracción o serie completa.
- Historial de ventas.
- Corrección de número, serie, fracción, fecha y precio de una venta.
- Anulación de ventas y devolución del boleto al stock.
- Métricas de inventario.
- Arqueo de caja por día, semana o mes.
- Gráfica de fracciones vendidas por día.
- Interfaz para seleccionar y arrastrar albaranes PDF.
- Formulario de alta manual de boletos.

La interfaz visible está en español. Los nombres técnicos de carpetas, archivos y componentes están en inglés.

## Tecnologías

- Next.js 16.3.3
- React 19
- TypeScript 5.7
- Tailwind CSS 4
- Lucide React
- Base UI
- Vercel Analytics
- pnpm mediante Corepack

## Requisitos

- Node.js 22 o superior
- Corepack habilitado para desarrollo

## Instalación

Desde la carpeta raíz del proyecto:

```powershell
corepack pnpm install
```

Si pnpm no está disponible, también puede utilizarse `npm install`. El repositorio mantiene `pnpm-lock.yaml` como archivo de bloqueo principal.

## Desarrollo

```powershell
corepack pnpm dev
```

También puede utilizarse:

```powershell
npm run dev
```

Después abre [http://localhost:3000](http://localhost:3000) en el navegador.

## Uso local recomendado

Para una persona usuaria no técnica, la aplicación debe distribuirse como un paquete de producción de Windows que incluya Node.js y abra el navegador automáticamente. El proceso de construcción de ese paquete debe ejecutar primero `npm run build` y conservar fuera de los archivos actualizables la carpeta de datos del usuario.

Durante el desarrollo o las pruebas locales, el flujo equivalente es:

```powershell
npm install
npm run build
npm run local:start
```

`local:start` ejecuta las migraciones, utiliza la carpeta `%LOCALAPPDATA%\LoteriaMercatDeColon\data` para `loteria.db` y abre `http://localhost:3000`. La variable `LOTERIA_DATA_DIR` permite elegir otra carpeta, por ejemplo para una copia de seguridad o una instalación compartida.

La versión final para Windows no debe pedir al usuario que instale Node, pnpm o Corepack. Debe incluir el runtime de Node y ejecutar el mismo `scripts/start-local.cjs`; así la aplicación local y la futura versión publicada en un servidor mantienen el mismo servidor Next.js y el mismo mecanismo de migraciones.

### Copias de seguridad y actualizaciones

Antes de actualizar, cierre la aplicación y copie `loteria.db` desde `%LOCALAPPDATA%\LoteriaMercatDeColon\data`. Las actualizaciones deben sustituir los archivos de la aplicación, no la carpeta de datos. Al iniciar una versión nueva se ejecutan las migraciones pendientes automáticamente.

## Compilación y producción

Para crear una compilación optimizada:

```powershell
corepack pnpm build
```

Para iniciar la versión compilada:

```powershell
corepack pnpm start
```

Equivalentes con npm:

```powershell
npm run build
npm run start
```

## Navegación

La aplicación utiliza una única página y cambia de vista mediante estado de React. No existe una URL independiente para cada pestaña.

Las pestañas son:

### Registro

Implementada en `components/record/record-tab.tsx`.

Incluye la interfaz de importación de albaranes PDF y el formulario de alta manual. Actualmente, la importación no analiza el contenido de los PDF y el alta manual todavía no incorpora nuevos boletos al inventario global.

### Inventario

Implementada en `components/inventory/inventory-tab.tsx`.

Muestra un buscador y una tabla jerárquica organizada así:

```text
Número
  Serie
    Fracción
```

La tabla muestra recibidos, vendidos y disponibles. También permite expandir y contraer niveles y vender cantidades disponibles.

### TPV

Implementada en `components/tpv/tpv-tab.tsx`.

Incluye una barra de venta rápida, el historial de operaciones y las acciones para corregir o anular ventas.

La venta rápida tiene dos modos:

- **Fracción**: vende un boleto unitario.
- **Serie**: vende todas las fracciones disponibles de una serie.

Admite identificadores separados por `/`, como `04521/002/3`, y códigos numéricos concatenados, como `045210023`.

### Análisis

Implementada en `components/analysis-tab.tsx`.

Muestra, en este orden:

1. Métricas globales de inventario.
2. Arqueo de caja.
3. Gráfica de fracciones vendidas por día.

## Estructura

```text
app/
  layout.tsx          Metadatos, fuentes, idioma y configuración global
  page.tsx            Estado principal y composición de las pestañas
  globals.css         Estilos globales y variables de diseño

components/
  app-header.tsx      Cabecera y navegación
  analysis-tab.tsx    Métricas, arqueo y análisis diario
  inventory/          Buscador, stock y venta desde inventario
  record/             Registro, albaranes y alta manual
  tpv/                Venta rápida, historial y arqueo
  ui/                 Componentes visuales reutilizables

lib/
  record-data.ts      Tipos, boletos, albaranes y operaciones de stock
  tpv-data.ts         Tipos, ventas, periodos y datos del historial
  utils.ts             Utilidades comunes

public/               Recursos estáticos
```

## Componentes importantes

### `components/inventory/`

- `inventory-tab.tsx`: composición de Inventario.
- `inventory-search.tsx`: buscador y filtros.
- `inventory-stock-table.tsx`: tabla jerárquica y acciones de venta.
- `inventory-metrics.tsx`: tarjetas de recibidos, disponibles y vendidos.
- `sell-control.tsx`: controles para vender cantidades.
- `inventory-tree-table.tsx`: tabla anterior conservada, no renderizada actualmente.

### `components/record/`

- `record-tab.tsx`: composición de Registro.
- `import-delivery-notes.tsx`: interfaz de importación de albaranes.
- `manual-entry.tsx`: formulario de alta manual.
- `record-tree-table.tsx`: tabla conservada para posible reutilización.

### `components/tpv/`

- `tpv-tab.tsx`: composición de TPV.
- `tpv-sale-search.tsx`: buscador y venta automática por código.
- `tpv-table.tsx`: historial de ventas.
- `edit-sale-dialog.tsx`: corrección de ventas.
- `cash-reconciliation-panel.tsx`: panel de arqueo reutilizado en Análisis.

## Datos y estado

El estado global vive en `app/page.tsx` y contiene:

- `tickets`: boletos disponibles en el inventario.
- `sales`: ventas registradas.

El inventario está definido en `lib/record-data.ts`. Cada boleto contiene número, serie, fracción, albarán, sorteo, año, fecha de registro y estado de venta.

El identificador de un boleto utiliza el formato:

```text
numero/serie/fraccion
```

Ejemplo:

```text
04521/002/3
```

Las funciones principales del inventario son:

- `ticketId`: genera el identificador de un boleto.
- `countStock`: calcula recibidos, vendidos y disponibles.
- `groupTickets`: agrupa los boletos por número y serie.

Las ventas están definidas en `lib/tpv-data.ts`. Cada venta contiene identificador, fecha, número, serie, fracción, datos del sorteo y precio. El precio estándar de demostración, definido en `PRECIO_DECIMO`, es de 20 euros.

## Flujo de venta

Al registrar una venta:

1. Se seleccionan uno o varios boletos.
2. Cada boleto se convierte en una venta.
3. Las ventas se añaden al historial.
4. Los boletos se marcan como vendidos.
5. Las métricas, el arqueo y la gráfica reciben el nuevo estado.

Al corregir una venta, se valida que el nuevo boleto exista y no esté vendido por otra operación. El boleto anterior vuelve a estar disponible y el nuevo queda marcado como vendido.

Al anular una venta, se elimina del historial y el boleto correspondiente vuelve a estar disponible.

## Estilos y accesibilidad

Los estilos globales están en `app/globals.css`. La aplicación utiliza tema claro, fuentes Geist y Geist Mono, azul como color principal y amarillo como color de énfasis.

También utiliza roles ARIA, etiquetas accesibles, estados de foco y mensajes dinámicos para las acciones principales.

El idioma del documento HTML es español mediante `lang="es"`.

## Configuración de Next.js

La configuración está en `next.config.mjs`.

Actualmente:

- `ignoreBuildErrors` está activado para el build de Next.js.
- Las imágenes están configuradas como no optimizadas.

Los metadatos, fuentes, iconos y el idioma global se configuran en `app/layout.tsx`. Vercel Analytics solo se renderiza en producción.

## Limitaciones conocidas

- Los datos no son persistentes.
- No existe backend ni base de datos.
- No hay autenticación ni gestión de usuarios.
- La importación PDF todavía no extrae información del archivo.
- El alta manual todavía no actualiza el inventario global.
- El lector de códigos depende de que el dispositivo escriba en el campo enfocado.
- La aplicación utiliza un único sorteo de demostración.
- Se recomienda ejecutar `npx tsc --noEmit` además de `npm run build`, porque el build de Next.js ignora los errores de TypeScript por configuración.
