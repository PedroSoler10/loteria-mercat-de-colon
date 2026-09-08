const { mkdirSync } = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = process.cwd()
const env = { ...process.env }
if (!env.DATABASE_URL) {
  mkdirSync(path.join(root, 'data'), { recursive: true })
  env.DATABASE_URL = 'file:../data/loteria.db'
}

const command = process.platform === 'win32' ? 'corepack.cmd' : 'corepack'
const packageManager = ['pnpm']
const migrate = spawnSync(command, [...packageManager, 'exec', 'prisma', 'migrate', 'deploy'], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (migrate.status !== 0) process.exit(migrate.status ?? 1)

const next = spawnSync(command, [...packageManager, 'exec', 'next', process.argv[2]], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(next.status ?? 1)
