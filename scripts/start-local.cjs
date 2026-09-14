const { existsSync, mkdirSync } = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const configDirectory = process.env.LOTERIA_CONFIG_DIR
  ?? path.join(process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? root, 'AppData', 'Local'), 'LoteriaMercatDeColon')
const defaultDataDirectory = process.env.LOTERIA_DATA_DIR ?? path.join(configDirectory, 'data')
const databasePath = path.join(defaultDataDirectory, 'loteria.db')
mkdirSync(defaultDataDirectory, { recursive: true })

const env = {
  ...process.env,
  LOTERIA_CONFIG_DIR: configDirectory,
  NODE_ENV: 'production',
  LOTERIA_DATA_DIR: defaultDataDirectory,
  DATABASE_URL: `file:${databasePath}`,
  PORT: process.env.PORT ?? '3000',
  NODE_PATH: path.join(root, 'node_modules'),
}

const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js')
execFileSync(process.execPath, [prismaCli, 'generate'], {
  cwd: root,
  env,
  stdio: 'inherit',
})
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

function startServer() {
  return new Promise((resolve) => {
    const server = spawn(process.execPath, [serverPath], { cwd: root, env, stdio: 'inherit' })
    server.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)))
  })
}

void (async () => {
  while (true) {
    const code = await startServer()
    if (code !== 75) process.exit(code)
    env.DATABASE_URL = `file:${databasePath}`
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], { cwd: root, env, stdio: 'inherit' })
  }
})()

const url = `http://localhost:${env.PORT}`
setTimeout(() => {
  const opener = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  spawn(opener, args, { stdio: 'ignore', detached: true }).unref()
}, 1000)
