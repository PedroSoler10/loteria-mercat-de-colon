param(
  [string]$OutputDirectory = (Join-Path (Get-Location) 'dist\LoteriaMercatDeColon'),
  [string]$NodeVersion = '22.14.0'
)

$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$nodeArchive = Join-Path $env:TEMP "node-v$NodeVersion-win-x64.zip"
$nodeExtract = Join-Path $env:TEMP "loteria-node-$NodeVersion"
$nodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"

if (Test-Path $OutputDirectory) {
  & $env:ComSpec /c "rmdir /s /q `"$OutputDirectory`""
  if (Test-Path $OutputDirectory) {
    $emptyDirectory = Join-Path $env:TEMP 'loteria-package-empty'
    New-Item $emptyDirectory -ItemType Directory -Force | Out-Null
    & robocopy $emptyDirectory $OutputDirectory /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
    & $env:ComSpec /c "rmdir /s /q `"$OutputDirectory`""
    Remove-Item $emptyDirectory -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $OutputDirectory) {
      throw "No se pudo limpiar el directorio de salida: $OutputDirectory"
    }
  }
}
New-Item $OutputDirectory -ItemType Directory -Force | Out-Null

Write-Host 'Compilando la aplicación...'
if (Test-Path '.next') {
  & $env:ComSpec /c 'rmdir /s /q ".next"'
  if (Test-Path '.next') {
    $emptyNextDirectory = Join-Path $env:TEMP 'loteria-empty-next'
    New-Item $emptyNextDirectory -ItemType Directory -Force | Out-Null
    & robocopy $emptyNextDirectory '.next' /MIR /XJ /NFL /NDL /NJH /NJS /NP | Out-Null
    & $env:ComSpec /c 'rmdir /s /q ".next"'
    Remove-Item $emptyNextDirectory -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path '.next') {
      throw 'No se pudo limpiar la compilación anterior de Next.js.'
    }
  }
}
corepack pnpm build
if ($LASTEXITCODE -ne 0) {
  throw "La compilación de producción ha fallado (código $LASTEXITCODE)."
}

if (-not (Test-Path $nodeArchive)) {
  Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeArchive
}
if (Test-Path $nodeExtract) { Remove-Item $nodeExtract -Recurse -Force }
Expand-Archive $nodeArchive -DestinationPath $nodeExtract

$runtimeDirectory = Join-Path $OutputDirectory 'runtime'
$appDirectory = Join-Path $OutputDirectory 'app'
Write-Host 'Copiando el runtime de Node...'
Copy-Item (Join-Path $nodeExtract "node-v$NodeVersion-win-x64") $runtimeDirectory -Recurse
Write-Host 'Preparando las dependencias de producción...'
New-Item $appDirectory -ItemType Directory -Force | Out-Null
Copy-Item 'package.json' (Join-Path $appDirectory 'package.json') -Force
Copy-Item 'prisma' (Join-Path $appDirectory 'prisma') -Recurse
Copy-Item 'prisma.config.ts' (Join-Path $appDirectory 'prisma.config.ts') -Force
Push-Location $appDirectory
npm install --omit=dev --ignore-scripts --no-audit --no-fund
$installExitCode = $LASTEXITCODE
Pop-Location
if ($installExitCode -ne 0) {
  throw "No se pudieron preparar las dependencias de producción (código $installExitCode)."
}
$prismaCli = Join-Path $appDirectory 'node_modules\prisma\build\index.js'
node $prismaCli generate --schema (Join-Path $appDirectory 'prisma\schema.prisma')
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo generar Prisma Client para el paquete."
}

Write-Host 'Copiando la compilación y los recursos...'
New-Item (Join-Path $appDirectory '.next') -ItemType Directory -Force | Out-Null
New-Item (Join-Path $appDirectory '.next\standalone') -ItemType Directory -Force | Out-Null
Copy-Item '.next\standalone\server.js' (Join-Path $appDirectory '.next\standalone\server.js') -Force
$standaloneNextSource = Join-Path $root '.next\standalone\.next'
$standaloneNextTarget = Join-Path $appDirectory '.next\standalone\.next'
Copy-Item $standaloneNextSource $standaloneNextTarget -Recurse -Force
$standaloneNextDirectory = Join-Path $appDirectory '.next\standalone\.next'
New-Item $standaloneNextDirectory -ItemType Directory -Force | Out-Null
Copy-Item '.next\static' (Join-Path $standaloneNextDirectory 'static') -Recurse -Force
# Next may include a second node_modules tree inside the standalone output. It
# contains junctions to the development checkout and must not shadow the
# self-contained production dependencies in the application directory.
$standaloneNextNodeModules = Join-Path $standaloneNextDirectory 'node_modules'
if (Test-Path $standaloneNextNodeModules) {
  Remove-Item $standaloneNextNodeModules -Recurse -Force
}
$prismaAliases = @(
  Get-ChildItem $standaloneNextTarget -Recurse -File -Filter '*.js' |
    ForEach-Object {
      $content = Get-Content -LiteralPath $_.FullName -Raw
      [regex]::Matches($content, '@prisma/client-[a-z0-9]+')
    } |
    ForEach-Object { $_.Value } |
    Sort-Object -Unique
)
foreach ($prismaAlias in $prismaAliases) {
  $aliasPackageName = $prismaAlias.Substring(8)
  $aliasDirectory = Join-Path $appDirectory "node_modules\@prisma\$aliasPackageName"
  New-Item $aliasDirectory -ItemType Directory -Force | Out-Null
  @'
{
  "main": "index.js"
}
'@ | Set-Content (Join-Path $aliasDirectory 'package.json') -Encoding ASCII
  "module.exports = require('@prisma/client')" |
    Set-Content (Join-Path $aliasDirectory 'index.js') -Encoding ASCII
}
$generatedPrismaClient = Join-Path $appDirectory 'node_modules\.prisma\client'
if (-not (Test-Path $generatedPrismaClient)) {
  throw 'No se encontró el Prisma Client generado en las dependencias de producción.'
}
Copy-Item 'public' (Join-Path $appDirectory '.next\standalone\public') -Recurse
Copy-Item 'scripts' (Join-Path $appDirectory 'scripts') -Recurse

# Nunca distribuir datos de desarrollo dentro del paquete portable.
Get-ChildItem $OutputDirectory -Recurse -File -Include '*.db', '*.sqlite', '*.sqlite3' -ErrorAction SilentlyContinue |
  Remove-Item -Force

@'
@echo off
set "LOTERIA_DATA_DIR=%LOCALAPPDATA%\LoteriaMercatDeColon\data"
set "LOTERIA_CONFIG_DIR=%LOCALAPPDATA%\LoteriaMercatDeColon"
"%~dp0runtime\node.exe" "%~dp0app\scripts\start-local.cjs"
'@ | Set-Content (Join-Path $OutputDirectory 'LoteriaMercatDeColon.cmd') -Encoding ASCII

@'
Lotería Mercat de Colón

Ejecute LoteriaMercatDeColon.cmd para iniciar la aplicación. Se abrirá el navegador automáticamente.
Los datos se guardan en %LOCALAPPDATA%\LoteriaMercatDeColon\data.
No elimine esa carpeta al actualizar la aplicación.
'@ | Set-Content (Join-Path $OutputDirectory 'LEEME.txt') -Encoding UTF8

Write-Host "Paquete creado en $OutputDirectory"
