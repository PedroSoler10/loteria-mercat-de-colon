const { mkdirSync, readFileSync } = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = process.cwd()
const env = { ...process.env }
if (!['development', 'production', 'test'].includes(env.NODE_ENV)) env.NODE_ENV = process.argv[2] === 'start' ? 'production' : 'development'
if (!env.DATABASE_URL) {
  const configDirectory = env.LOTERIA_CONFIG_DIR ?? path.join(root, 'data')
  const defaultDataDirectory = env.LOTERIA_DATA_DIR ?? configDirectory
  let dataDirectory = defaultDataDirectory
  try {
    const configured = JSON.parse(readFileSync(path.join(configDirectory, 'database-location.json'), 'utf8'))
    if (typeof configured.databasePath === 'string' && path.isAbsolute(configured.databasePath)) dataDirectory = path.dirname(configured.databasePath)
  } catch {
    // The default data directory is used until the user chooses another location.
  }
  env.LOTERIA_CONFIG_DIR = configDirectory
  mkdirSync(dataDirectory, { recursive: true })
  env.DATABASE_URL = `file:${path.join(dataDirectory, 'loteria.db')}`
}

const command = process.platform === 'win32' ? process.execPath : 'corepack'
const commandArgs = process.platform === 'win32'
  ? [path.join(process.env.ProgramW6432 ?? 'C:\\Program Files', 'nodejs', 'node_modules', 'corepack', 'dist', 'corepack.js')]
  : []
const packageManager = ['pnpm']
const migrate = spawnSync(command, [...commandArgs, ...packageManager, 'exec', 'prisma', 'migrate', 'deploy'], {
  cwd: root,
  env,
  stdio: 'inherit',
})

if (migrate.status !== 0) process.exit(migrate.status ?? 1)

const next = spawnSync(command, [...commandArgs, ...packageManager, 'exec', 'next', process.argv[2]], {
  cwd: root,
  env,
  stdio: 'inherit',
})

process.exit(next.status ?? 1)
