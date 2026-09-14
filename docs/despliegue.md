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

Al actualizar la aplicación, se sustituye la carpeta del paquete, pero no se
debe borrar la carpeta de datos. Las migraciones pendientes se aplican al
arrancar. Antes de actualizar conviene copiar `loteria.db` como copia de
seguridad.

## Resumen rápido

| Escenario | Necesita Node/pnpm | Necesita código fuente | Necesita base de datos |
| --- | --- | --- | --- |
| Desarrollo | Sí | Sí | Se crea o se configura localmente |
| Crear paquete Windows | Sí, PowerShell e Internet | Sí | No; el paquete se crea sin datos |
| Usar paquete construido | No | No | Se crea al primer inicio o se importa |
