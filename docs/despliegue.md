# Despliegue y distribución

Esta aplicación es una aplicación Next.js local para Windows. El servidor web
se ejecuta en el propio ordenador y usa una base de datos SQLite local; no
hay una base de datos remota ni un servicio externo necesario para el uso
normal.

## Qué se sube a GitHub

El repositorio debe contener el código y la configuración necesarios para
reproducir la aplicación:

- `app/`, `components/` y `lib/`: interfaz, API y lógica compartida.
- `public/`: iconos y recursos estáticos.
- `prisma/schema.prisma`, `prisma/migrations/`, `prisma/migration_lock.toml`
  y `prisma/seed.cjs`: modelo, migraciones y semilla de la base de datos.
- `scripts/`: arranque, importación y empaquetado.
- `package.json` y `pnpm-lock.yaml`: dependencias y versiones bloqueadas.
- `next.config.mjs`, `postcss.config.mjs`, `components.json`,
  `prisma.config.ts`, `tsconfig.json` y `pnpm-workspace.yaml`: configuración
  del proyecto.
- `next-env.d.ts`, documentación y `.env.example`.

No se deben subir:

- `.env` ni `.env.local`: pueden contener rutas o secretos específicos de una
  máquina. `.env.example` sí se versiona como plantilla.
- `node_modules/`: dependencias instaladas; se regeneran con pnpm.
- `.next/`: compilación generada; se regenera en cada build.
- `dist/`: paquetes portables generados para distribución.
- `data/`, `loteria.db` y cualquier archivo `.db`, `.sqlite` o `.sqlite3`:
  contienen los datos reales de la administración.
- Logs, copias de seguridad y archivos PDF o TXT importados, salvo que se
  archiven expresamente fuera del código.

`tsconfig.tsbuildinfo` también es un archivo generado por TypeScript y no debe
formar parte de una publicación nueva. Si ya aparece versionado en una copia
antigua del repositorio, puede eliminarse en un commit de limpieza.

## Ordenador de desarrollo y de empaquetado

El ordenador que desarrolla o crea la distribución necesita:

- Windows de 64 bits si se va a crear el paquete Windows.
- Node.js 22 o posterior.
- Corepack habilitado para proporcionar pnpm 11.25.0.
- PowerShell.
- Acceso a Internet durante la primera instalación y durante el empaquetado:
  `package-windows.ps1` descarga el runtime de Node que incluirá en el
  paquete.

Después de clonar el repositorio:

```powershell
corepack enable
corepack pnpm install
corepack pnpm dev
```

`dev` crea o prepara la base de datos local, aplica las migraciones y abre el
servidor de desarrollo. En Windows, por defecto los datos quedan en
`%LOCALAPPDATA%\LoteriaMercatDeColon\data`; la ubicación puede cambiarse con
`LOTERIA_DATA_DIR`. Para producción local, la comprobación equivalente es:

```powershell
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm build
corepack pnpm local:start
```

El type-check se ejecuta por separado porque la configuración de Next.js no
bloquea el build por errores de TypeScript.

Para crear la distribución portable:

```powershell
corepack pnpm package:windows
```

Este comando compila la aplicación, instala las dependencias de producción,
genera Prisma Client, incluye las migraciones y descarga un runtime de Node
para Windows. El resultado es:

```text
dist\LoteriaMercatDeColon\
```

Durante el empaquetado, las dependencias de producción se instalan con npm en
la carpeta temporal de distribución. Esto es intencionado: pnpm se mantiene
como gestor del proyecto y de desarrollo, pero sus enlaces internos no se
incluyen en el portable. El resultado contiene copias físicas de las
dependencias y el alias de Prisma que emite Next.js, por lo que se puede mover
a otra carpeta u otro ordenador sin conservar rutas del equipo que lo generó.

Antes de distribuirlo, compruebe que no contiene archivos de base de datos.
Se puede comprimir la carpeta completa, pero el usuario debe descomprimirla
antes de ejecutar el lanzador.

## Ordenador que solo usa el paquete construido

El ordenador de destino solo necesita:

- Windows de 64 bits compatible con el runtime incluido.
- Permiso para ejecutar una aplicación desde la carpeta donde se
  descomprima.
- Un navegador web moderno.

No necesita Node.js, npm, pnpm, Corepack, Prisma, Git ni herramientas de
compilación. Tampoco necesita conexión a Internet para iniciar la aplicación
después de haber recibido el paquete.

Pasos:

1. Descomprimir `dist\LoteriaMercatDeColon` en una carpeta local.
2. Ejecutar `LoteriaMercatDeColon.cmd`.
3. Completar el asistente inicial creando una base de datos nueva o
   importando una copia `.db`, `.sqlite` o `.sqlite3`.

El lanzador inicia el servidor en `http://localhost:3000` y abre el navegador.
Mientras se use la aplicación debe permanecer abierta la ventana de consola.
Para cerrarla, se cierra esa ventana.

Los datos no se guardan dentro de la carpeta del paquete. Se guardan en:

```text
%LOCALAPPDATA%\LoteriaMercatDeColon\data\loteria.db
```

La configuración de la ubicación de la base de datos se guarda en:

```text
%LOCALAPPDATA%\LoteriaMercatDeColon\database-location.json
```

Los sorteos configurados (juegos, año, número, nombre y precio) se guardan junto a ella, en `%LOCALAPPDATA%\LoteriaMercatDeColon\sorteos.json`. Se pueden editar desde **Registro → Sorteos** y el archivo se crea solo la primera vez. Si cambia de base de datos, conserve también este archivo.

Al actualizar la aplicación, se sustituye la carpeta del paquete, pero no se
debe borrar la carpeta de datos. Las migraciones pendientes se aplican al
arrancar. Antes de actualizar conviene copiar `loteria.db` como copia de
seguridad.

## Actualizar una base de datos con la estructura antigua

Las bases creadas antes de unificar `ventas` y `cedidos` dentro de `boletos` se actualizan con las migraciones de `prisma/migrations`. Hay tres formas, de más a menos recomendable para una base importante (como la de producción):

1. **Migrar una copia con el script** (la original nunca se modifica):

   ```bash
   pnpm db:migrar -- "C:\ruta\antigua.db"
   ```

   Crea `antigua.migrada.db` junto a la original, aplica las migraciones sobre esa copia y compara los totales (boletos, ventas activas y cedidos). Después abre la aplicación con la copia migrada, o impórtala desde Registro. Si la base ya tiene la estructura actual, lo indica y no hace nada.

2. **Importar la base desde Registro** (arrastrando el `.db`). La aplicación guarda una copia de la base actual (`loteria.db.antes-de-importar`), migra la importada y, si la migración falla, restaura la anterior.

3. **Arrancar la aplicación con la base antigua** (`pnpm dev` o `pnpm local:start`): las migraciones pendientes se aplican al arrancar.

Haz siempre una copia de seguridad antes de migrar una base real.

### Si la migración se detiene

La migración **no decide por el usuario**. Se detiene, sin modificar nada, si un boleto figura a la vez como vendido y cedido, o cedido por varios albaranes. El mensaje indica `ABORTADO_hay_boletos_vendidos_y_cedidos…`. Para resolverlo:

1. Localiza los conflictos con las consultas que hay al principio de `prisma/migrations/20260930130000_fusionar_boletos_ventas_cedidos/migration.sql`.
2. Con la versión anterior de la aplicación, anula la venta (si en realidad es una cesión) o elimina el albarán de cesión que sobra (si en realidad es una venta). El albarán se podrá volver a importar después en la versión nueva, que preguntará qué hacer con cada boleto.
3. Repite la migración. Si se había intentado directamente sobre la base (opción 3), antes hay que marcar la migración como no aplicada: `pnpm exec prisma migrate resolve --rolled-back 20260930130000_fusionar_boletos_ventas_cedidos`.

La migración `20261007100000_construir_codigo_barras`, posterior, reconstruye el código de barras de los boletos que venían de un albarán (ver [codigo-barras-seleae.md](codigo-barras-seleae.md)).

## Resumen rápido

| Escenario | Necesita Node/pnpm | Necesita código fuente | Necesita base de datos |
| --- | --- | --- | --- |
| Desarrollo | Sí | Sí | Se crea o se configura localmente |
| Crear paquete Windows | Sí, PowerShell e Internet | Sí | No; el paquete se crea sin datos |
| Usar paquete construido | No | No | Se crea al primer inicio o se importa |
