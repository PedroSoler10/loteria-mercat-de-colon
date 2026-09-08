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

npm run build

if (-not (Test-Path $nodeArchive)) {
  Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeArchive
}
if (Test-Path $nodeExtract) { Remove-Item $nodeExtract -Recurse -Force }
Expand-Archive $nodeArchive -DestinationPath $nodeExtract

$runtimeDirectory = Join-Path $OutputDirectory 'runtime'
$appDirectory = Join-Path $OutputDirectory 'app'
Copy-Item (Join-Path $nodeExtract "node-v$NodeVersion-win-x64") $runtimeDirectory -Recurse
New-Item $appDirectory -ItemType Directory -Force | Out-Null

Copy-Item '.next' (Join-Path $appDirectory '.next') -Recurse
Copy-Item 'public' (Join-Path $appDirectory 'public') -Recurse
Copy-Item 'prisma' (Join-Path $appDirectory 'prisma') -Recurse
Copy-Item 'scripts' (Join-Path $appDirectory 'scripts') -Recurse
Copy-Item 'node_modules' (Join-Path $appDirectory 'node_modules') -Recurse

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
