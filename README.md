# Lotería Mercat de Colón

Aplicación web local para gestionar albaranes, inventario de boletos, cesiones, ventas y análisis de una administración de lotería.

Este documento está organizado para que una persona pueda empezar a utilizar la aplicación sin conocimientos técnicos. La información de desarrollo y arquitectura aparece al final.

## 1. Instalación para usuarios

### Opción recomendada: paquete portable de Windows

La distribución final está pensada para Windows y no requiere instalar Node.js, pnpm, Corepack ni ningún programa de desarrollo.

1. Descargue y descomprima el paquete de la aplicación en una carpeta local.
2. Abra la carpeta descomprimida.
3. Haga doble clic en `LoteriaMercatDeColon.cmd`.
4. Espere unos segundos. La aplicación iniciará un servidor local y abrirá automáticamente el navegador.
5. Si el navegador no se abre, visite `http://localhost:3000`.

Mientras la aplicación esté abierta, no cierre la ventana de consola que se haya iniciado junto al servidor. Para cerrar la aplicación, cierre esa ventana.

Los datos se guardan en:

```text
%LOCALAPPDATA%\LoteriaMercatDeColon\data
```

La base de datos principal es `loteria.db`. No borre esta carpeta al actualizar la aplicación: contiene todos los albaranes, boletos, cesiones y ventas.

### Primera instalación desde el repositorio

Este procedimiento está destinado a quien prepara la aplicación, no al usuario final:

```powershell
corepack pnpm install
npm run build
npm run package:windows
```

El paquete se genera en `dist\LoteriaMercatDeColon`. Incluye:

- La compilación optimizada de Next.js.
- El runtime de Node.js para Windows.
- Prisma y las migraciones de la base de datos.
- Un archivo `.cmd` para iniciar la aplicación con doble clic.

El proyecto utiliza pnpm y conserva `pnpm-lock.yaml` como archivo de bloqueo oficial. No ejecute `npm install` en una carpeta donde ya exista `node_modules` creada por pnpm: npm 11 puede fallar al intentar deduplicar los enlaces internos de pnpm con el error `Cannot read properties of null (reading 'matches')`. Use siempre:

```powershell
corepack pnpm install
```

Si ya se ejecutó `npm install` y dejó la instalación en un estado inconsistente, cierre los procesos de desarrollo y elimine únicamente la carpeta `node_modules` del proyecto antes de volver a ejecutar `corepack pnpm install`. No elimine la carpeta `data`.

### Actualizar la aplicación

1. Cierre la aplicación.
2. Haga una copia de seguridad de `loteria.db`.
3. Sustituya los archivos de la aplicación por los de la nueva versión.
4. No sustituya ni elimine `%LOCALAPPDATA%\LoteriaMercatDeColon\data`.
5. Vuelva a ejecutar `LoteriaMercatDeColon.cmd`.

Las migraciones pendientes se aplican automáticamente al iniciar una versión nueva.

### Copia de seguridad y restauración

La pestaña **Registro** incluye un bloque único de **Importar datos**, desde el que puede:

- Arrastrar o seleccionar PDF de albaranes y archivos `.db`, `.sqlite` o `.sqlite3`. La aplicación envía cada formato automáticamente al importador correcto.
- Elegir una ubicación en el explorador para guardar una copia de la base de datos cuando no tenga ningún archivo que importar.
- Descargar una copia de seguridad desde la propia aplicación.

Para hacer una copia de seguridad manual:

1. Cierre la aplicación.
2. Abra el Explorador de archivos y escriba `%LOCALAPPDATA%\LoteriaMercatDeColon\data` en la barra de direcciones.
3. Copie `loteria.db` a otra ubicación, preferiblemente a un disco externo o almacenamiento seguro.

Para restaurar una copia desde la aplicación, seleccione el archivo en **Registro → Base de datos → Importar archivo** y recargue la página. También puede hacerlo manualmente:

1. Cierre la aplicación.
2. Cambie el nombre de la base de datos actual, por ejemplo a `loteria-antes-de-restaurar.db`.
3. Copie la copia de seguridad dentro de la carpeta `data`.
4. Compruebe que el archivo restaurado se llama exactamente `loteria.db`.
5. Inicie de nuevo la aplicación.

### Problemas frecuentes

**El navegador indica que no se puede conectar**

Compruebe que la ventana de la aplicación sigue abierta y visite `http://localhost:3000`. Si el puerto está ocupado por otra aplicación, cierre esa aplicación y vuelva a iniciar Lotería Mercat de Colón.

**La aplicación no conserva los datos**

Compruebe que está iniciando siempre la aplicación con `LoteriaMercatDeColon.cmd` y que no ha eliminado la carpeta `%LOCALAPPDATA%\LoteriaMercatDeColon\data`.

**La aplicación no se inicia después de una actualización**

Restaure la copia de seguridad de `loteria.db`, conserve la carpeta de datos y contacte con la persona responsable de la instalación. No elimine la base de datos como primera medida.

## 2. Tutorial de uso

Al iniciar la aplicación se abre la pestaña **TPV**. La navegación principal está en la parte superior.

### 2.1. Registrar albaranes y boletos

Abra la pestaña **Registro** para cargar la información recibida.

#### Importar un albarán PDF

1. Abra **Registro**.
2. Seleccione el archivo PDF del albarán o arrástrelo a la zona de importación.
3. Espere a que termine el análisis.
4. Compruebe el sorteo, el identificador del albarán, el tipo de origen y el número de fracciones importadas.
5. Consulte la tabla de **Importaciones registradas**.

La aplicación evita duplicar un albarán ya cargado. Si se vuelve a cargar el mismo documento, recupera o actualiza el registro existente cuando corresponde.

Las cesiones de consignación aparecen en la tabla **Cedidos**, separadas de las importaciones recibidas. Una cesión puede quedar registrada aunque el boleto todavía no exista en los recibidos.

#### Alta manual o mediante lector

Use el formulario de alta manual cuando un boleto no esté incluido en un albarán:

1. Introduzca el sorteo, número, serie y fracción.
2. Introduzca los dígitos de control si los conoce; si no, se utiliza `0000`.
3. Para una lectura con pistola, coloque el cursor en el campo correspondiente y escanee el código.
4. Guarde el alta.

Las altas manuales y las lecturas sin albarán reciben un origen provisional. Si posteriormente se importa un albarán con los mismos datos, la aplicación puede asociar el boleto al albarán definitivo.

En las tablas de Registro puede:

- Expandir y contraer sorteos, cargas, números, series y fracciones.
- Ordenar visualmente las cargas por identificador y después por número.
- Editar los datos de una carga.
- Eliminar una carga mediante la columna **Acciones**.

### 2.2. Consultar inventario

Abra **Inventario** para consultar el stock organizado por:

```text
Número
  Serie
    Fracción
```

La tabla distingue entre:

- **Recibidos**: fracciones registradas en albaranes o altas manuales.
- **Cedidos**: fracciones entregadas a otra administración.
- **Vendidos**: fracciones con una venta activa.
- **Disponibles**: recibidos menos cedidos menos vendidos.

Utilice el buscador para localizar un número, serie o fracción. Puede expandir los niveles de la tabla y vender desde las fracciones disponibles.

### 2.3. Registrar ventas en el TPV

En **TPV** puede vender mediante búsqueda manual o lector de códigos:

1. Introduzca el código de barras o los datos del boleto.
2. Seleccione el boleto encontrado.
3. Elija vender una fracción o la serie completa cuando esté disponible.
4. Confirme la venta.

El historial transaccional muestra todas las ventas, no solo las del día. Las ventas se agrupan jerárquicamente por:

```text
Mes
  Semana
    Día
      Venta
```

Cada nivel se puede expandir o contraer. También existen los botones **Expandir todo** y **Contraer todo**.

Desde cada venta puede:

- Editar fecha, precio, número, serie o fracción.
- Anular una venta activa.
- Restaurar una venta anulada.
- Eliminar definitivamente una venta anulada.

Las ventas importadas desde un archivo de texto se pueden cargar con el proceso preparado para ello. El archivo debe contener una cabecera `Código Fecha Hora` y una venta por línea.

### 2.4. Consultar análisis y caja

Abra **Análisis** para consultar:

- Fracciones recibidas, cedidas, vendidas y disponibles.
- Porcentaje de fracciones disponibles frente a recibidas.
- Arqueo de caja.
- Ingresos y número de operaciones por día, semana o mes.
- Gráfica de fracciones vendidas.

En la gráfica puede cambiar entre **Días**, **Semanas** y **Meses**. En la vista diaria también aparecen los días sin ventas entre la primera y la última fecha registrada, con valor cero.

### 2.5. Recomendaciones de uso

- Haga una copia de seguridad al final de cada jornada o antes de importar muchos documentos.
- No cierre la aplicación mientras se está importando un PDF o registrando una venta.
- Compruebe el número de fracciones después de cargar un albarán.
- No borre manualmente la base de datos para resolver un problema sin conservar antes una copia.

## 3. Descripción técnica del proyecto

### Tecnologías

- Next.js `16.3.3`.
- React `19`.
- TypeScript `5.7`.
- Tailwind CSS `4`.
- Prisma `6.19`.
- SQLite.
- pnpm mediante Corepack para desarrollo.
- PDF.js para analizar albaranes.
- Base UI y Lucide React para la interfaz.

### Arquitectura

La aplicación es una aplicación Next.js con una página principal y API Route Handlers:

```text
app/page.tsx                 Estado y navegación principal
app/api/inventory            Inventario calculado
app/api/sales                Ventas y operaciones del TPV
app/api/cedidos              Cesiones
app/api/delivery-notes       Importación de albaranes PDF
app/api/manual-entry         Altas manuales y escaneadas
app/api/origins              Cargas y albaranes
components/                  Interfaz React
lib/                         Tipos y lógica compartida
prisma/                      Schema y migraciones SQLite
scripts/                     Arranque, importadores y empaquetado
```

El estado de la interfaz se coordina en `app/page.tsx`, que carga inventario, ventas, cedidos y orígenes desde la API y actualiza las vistas después de cada operación.

### Modelo de datos

Prisma define principalmente:

- `Sorteo`: datos del sorteo y precio unitario.
- `Origen`: albarán, alta manual o origen provisional.
- `Boleto`: número, serie, fracción, dígitos de control y código de barras.
- `Venta`: venta activa o anulada.
- `Cedido`: fracción cedida y su relación opcional con un boleto recibido.

El stock disponible se calcula como:

```text
disponibles = recibidos - cedidos - vendidos
```

Las migraciones están en `prisma/migrations`. No deben modificarse ni eliminarse las migraciones ya aplicadas; para cambiar el esquema se debe crear una migración nueva.

### Arranque y persistencia

Para desarrollo:

```powershell
corepack pnpm install
corepack pnpm dev
```

El script de desarrollo prepara la base de datos y ejecuta las migraciones antes de iniciar Next.js.

Para producción:

```powershell
corepack pnpm build
corepack pnpm start
```

Para iniciar una instalación local y abrir el navegador automáticamente:

```powershell
corepack pnpm build
corepack pnpm local:start
```

`next.config.mjs` utiliza `output: 'standalone'` para generar una compilación autocontenida. `scripts/start-local.cjs` aplica las migraciones, inicia el servidor standalone y abre `http://localhost:3000`.

La ubicación de datos puede cambiarse con `LOTERIA_DATA_DIR`. Si no se especifica, la instalación local utiliza:

```text
%LOCALAPPDATA%\LoteriaMercatDeColon\data
```

### Empaquetado para Windows

El script:

```powershell
npm run package:windows
```

ejecuta la compilación y genera `dist\LoteriaMercatDeColon`. `scripts/package-windows.ps1` incluye el runtime de Node para Windows, `.next`, `public`, `prisma`, `scripts` y `node_modules`, además del lanzador `.cmd`.

Para una distribución comercial puede sustituirse el paquete portable por un instalador MSI o NSIS. El instalador debe:

- Instalar los archivos de aplicación fuera de la carpeta de datos.
- Crear un acceso directo a `LoteriaMercatDeColon.cmd`.
- Mantener `%LOCALAPPDATA%\LoteriaMercatDeColon\data` durante las actualizaciones.
- Ejecutar migraciones al iniciar una nueva versión.
- Incluir una opción clara para abrir la carpeta de copias de seguridad.

### Importador de ventas

El comando de importación es:

```powershell
corepack pnpm sales:import -- "C:\ruta\ventas.txt"
```

El archivo debe comenzar por:

```text
Código Fecha Hora
```

El importador acepta fechas y horas con una o dos cifras, es idempotente y crea un origen provisional `VENT-AAAA-MM-DD-HH-MM-SS` cuando el boleto no estaba registrado.

### Validación

Comandos recomendados antes de publicar una versión:

```powershell
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm build
```

El build de Next.js está configurado para no bloquearse por errores de TypeScript; por eso el type-check debe ejecutarse por separado.

### Desarrollo futuro

La aplicación local utiliza el mismo servidor Next.js que puede desplegarse en un servidor. Para una versión web permanente será necesario añadir, según las necesidades:

- Un servidor o plataforma de despliegue.
- Una base de datos compartida y copias de seguridad automatizadas.
- Autenticación y autorización de usuarios.
- Gestión de archivos PDF en almacenamiento persistente.
- HTTPS, dominio y monitorización.
