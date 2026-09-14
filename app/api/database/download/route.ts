import { createReadStream } from 'node:fs'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getDatabasePath } from '@/lib/database-location'

export const dynamic = 'force-dynamic'
const execFileAsync = promisify(execFile)

export async function GET(request: Request) {
  const empty = new URL(request.url).searchParams.get('empty') === 'true'
  if (empty) {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'loteria-empty-'))
    const temporaryPath = path.join(temporaryDirectory, 'loteria.db')
    try {
      const prismaCli = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js')
      await execFileAsync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: `file:${temporaryPath}` },
      })
      const contents = await readFile(temporaryPath)
      return new Response(contents, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="loteria.db"',
        },
      })
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true })
    }
  }

  const databasePath = getDatabasePath()
  const file = await stat(databasePath)
  if (!file.isFile()) return Response.json({ error: 'No existe la base de datos.' }, { status: 404 })
  return new Response(createReadStream(databasePath) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="loteria-backup.db"',
    },
  })
}
