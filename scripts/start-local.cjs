const { existsSync, mkdirSync } = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const dataDirectory = process.env.LOTERIA_DATA_DIR
  ?? path.join(process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? root, 'AppData', 'Local'), 'LoteriaMercatDeColon', 'data')
mkdirSync(dataDirectory, { recursive: true })

const env = {
  ...process.env,
  NODE_ENV: 'production',
  LOTERIA_DATA_DIR: dataDirectory,
  DATABASE_URL: `file:${path.join(dataDirectory, 'loteria.db')}`,
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
