param(
  [string]$OutputDirectory = (Join-Path (Get-Location) 'dist\LoteriaMercatDeColon'),
  [string]$NodeVersion = '22.14.0'
)

$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$nodeArchive = Join-Path $env:TEMP "node-v$NodeVersion-win-x64.zip"
$nodeExtract = Join-Path $env:TEMP "loteria-node-$NodeVersion"
$nodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"

if (Test-Path $OutputDirectory) { Remove-Item $OutputDirectory -Recurse -Force }
New-Item $OutputDirectory -ItemType Directory -Force | Out-Null

Write-Host 'Compilando la aplicación...'
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
Copy-Item 'pnpm-lock.yaml' (Join-Path $appDirectory 'pnpm-lock.yaml') -Force
Copy-Item 'prisma' (Join-Path $appDirectory 'prisma') -Recurse
Copy-Item 'prisma.config.ts' (Join-Path $appDirectory 'prisma.config.ts') -Force
@'
onlyBuiltDependencies[]=prisma
onlyBuiltDependencies[]=@prisma/client
onlyBuiltDependencies[]=@prisma/engines
'@ | Set-Content (Join-Path $appDirectory '.npmrc') -Encoding ASCII
Push-Location $appDirectory
corepack pnpm install --prod --ignore-workspace --ignore-scripts --frozen-lockfile
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
Copy-Item '.next\standalone\*' (Join-Path $appDirectory '.next\standalone') -Recurse -Force
$standaloneNextDirectory = Join-Path $appDirectory '.next\standalone\.next'
New-Item $standaloneNextDirectory -ItemType Directory -Force | Out-Null
Copy-Item '.next\static' (Join-Path $standaloneNextDirectory 'static') -Recurse -Force
$standaloneNodeModules = Join-Path $appDirectory '.next\standalone\node_modules'
New-Item $standaloneNodeModules -ItemType Directory -Force | Out-Null
New-Item (Join-Path $standaloneNodeModules '@swc') -ItemType Directory -Force | Out-Null
$swcHelpersPackage = Get-ChildItem (Join-Path $appDirectory 'node_modules\.pnpm') -Directory -Filter '@swc+helpers@*' | Select-Object -First 1
if (-not $swcHelpersPackage) {
  throw 'No se encontró @swc/helpers en las dependencias de producción.'
}
Copy-Item (Join-Path $swcHelpersPackage.FullName 'node_modules\@swc\helpers') (Join-Path $standaloneNodeModules '@swc\helpers') -Recurse -Force
$nextEnvPackage = Get-ChildItem (Join-Path $appDirectory 'node_modules\.pnpm') -Directory -Filter '@next+env@*' | Select-Object -First 1
if (-not $nextEnvPackage) {
  throw 'No se encontró @next/env en las dependencias de producción.'
}
New-Item (Join-Path $standaloneNodeModules '@next') -ItemType Directory -Force | Out-Null
Copy-Item (Join-Path $nextEnvPackage.FullName 'node_modules\@next\env') (Join-Path $standaloneNodeModules '@next\env') -Recurse -Force
Copy-Item 'public' (Join-Path $appDirectory '.next\standalone\public') -Recurse
Copy-Item 'scripts' (Join-Path $appDirectory 'scripts') -Recurse

@'
@echo off
set "LOTERIA_DATA_DIR=%LOCALAPPDATA%\LoteriaMercatDeColon\data"
"%~dp0runtime\node.exe" "%~dp0app\scripts\start-local.cjs"
'@ | Set-Content (Join-Path $OutputDirectory 'LoteriaMercatDeColon.cmd') -Encoding ASCII

@'
Lotería Mercat de Colón

Ejecute LoteriaMercatDeColon.cmd para iniciar la aplicación. Se abrirá el navegador automáticamente.
Los datos se guardan en %LOCALAPPDATA%\LoteriaMercatDeColon\data.
No elimine esa carpeta al actualizar la aplicación.
'@ | Set-Content (Join-Path $OutputDirectory 'LEEME.txt') -Encoding UTF8

Write-Host "Paquete creado en $OutputDirectory"
