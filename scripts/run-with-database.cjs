const { mkdirSync } = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = process.cwd()
const env = { ...process.env }
if (!['development', 'production', 'test'].includes(env.NODE_ENV)) env.NODE_ENV = process.argv[2] === 'start' ? 'production' : 'development'
if (!env.DATABASE_URL) {
  const configDirectory = env.LOTERIA_CONFIG_DIR
    ?? path.join(process.env.LOCALAPPDATA ?? path.join(root, 'data'), 'LoteriaMercatDeColon')
  const defaultDataDirectory = env.LOTERIA_DATA_DIR ?? path.join(configDirectory, 'data')
  env.LOTERIA_CONFIG_DIR = configDirectory
  mkdirSync(defaultDataDirectory, { recursive: true })
  env.LOTERIA_DATA_DIR = defaultDataDirectory
  env.DATABASE_URL = `file:${path.join(defaultDataDirectory, 'loteria.db')}`
}

const command = process.platform === 'win32' ? process.execPath : 'corepack'
const commandArgs = process.platform === 'win32'
  ? [path.join(process.env.ProgramW6432 ?? 'C:\\Program Files', 'nodejs', 'node_modules', 'corepack', 'dist', 'corepack.js')]
  : []
const packageManager = ['pnpm']
const generate = spawnSync(command, [...commandArgs, ...packageManager, 'exec', 'prisma', 'generate'], {
  cwd: root,
  env,
  stdio: 'inherit',
})

if (generate.status !== 0) process.exit(generate.status ?? 1)

const migrate = spawnSync(command, [...commandArgs, ...packageManager, 'exec', 'prisma', 'migrate', 'deploy'], {
  cwd: root,
  env,
  stdio: 'inherit',
})

if (migrate.status !== 0) process.exit(migrate.status ?? 1)

while (true) {
  const next = spawnSync(command, [...commandArgs, ...packageManager, 'exec', 'next', process.argv[2]], {
    cwd: root,
    env,
    stdio: 'inherit',
  })
  if (next.status !== 75) process.exit(next.status ?? 1)

  env.DATABASE_URL = `file:${path.join(env.LOTERIA_DATA_DIR, 'loteria.db')}`
  const migrated = spawnSync(command, [...commandArgs, ...packageManager, 'exec', 'prisma', 'migrate', 'deploy'], {
    cwd: root,
    env,
    stdio: 'inherit',
  })
  if (migrated.status !== 0) process.exit(migrated.status ?? 1)
}
