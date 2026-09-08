const { existsSync, mkdirSync, readFileSync } = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const configDirectory = process.env.LOTERIA_CONFIG_DIR
  ?? path.join(process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? root, 'AppData', 'Local'), 'LoteriaMercatDeColon')
const defaultDataDirectory = process.env.LOTERIA_DATA_DIR ?? path.join(configDirectory, 'data')
let dataDirectory = defaultDataDirectory
let databasePath = path.join(dataDirectory, 'loteria.db')
try {
  const configured = JSON.parse(readFileSync(path.join(configDirectory, 'database-location.json'), 'utf8'))
  if (typeof configured.databasePath === 'string' && path.isAbsolute(configured.databasePath)) {
    databasePath = configured.databasePath
    dataDirectory = path.dirname(databasePath)
  }
} catch {
  // The default data directory is used until the user chooses another location.
}
mkdirSync(dataDirectory, { recursive: true })

const env = {
  ...process.env,
  LOTERIA_CONFIG_DIR: configDirectory,
  NODE_ENV: 'production',
  LOTERIA_DATA_DIR: dataDirectory,
  DATABASE_URL: `file:${databasePath}`,
  PORT: process.env.PORT ?? '3000',
  NODE_PATH: path.join(root, 'node_modules'),
}

const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js')
const migration = execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: root,
  env,
  stdio: 'inherit',
})
void migration

const serverPath = path.join(root, '.next', 'standalone', 'server.js')
if (!existsSync(serverPath)) {
  throw new Error('No existe la compilación de producción. Ejecuta primero: npm run build')
}

const server = spawn(process.execPath, [serverPath], { cwd: root, env, stdio: 'inherit' })
server.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))

const url = `http://localhost:${env.PORT}`
setTimeout(() => {
  const opener = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  spawn(opener, args, { stdio: 'ignore', detached: true }).unref()
}, 1000)
