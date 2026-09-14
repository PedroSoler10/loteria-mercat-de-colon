import { copyFile, mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { configureDatabase, getConfiguredDatabasePath, getDatabasePath, isDatabaseConfigured } from '@/lib/database-location'

export const dynamic = 'force-dynamic'
export async function GET() {
  return Response.json({ path: await getConfiguredDatabasePath(), configured: await isDatabaseConfigured() })
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) return Response.json({ error: 'Selecciona un archivo SQLite.' }, { status: 400 })

    const contents = Buffer.from(await file.arrayBuffer())
    if (contents.subarray(0, 16).toString() !== 'SQLite format 3\u0000') {
      return Response.json({ error: 'El archivo no parece una base de datos SQLite válida.' }, { status: 400 })
    }

    const databasePath = getDatabasePath()
    const temporaryPath = `${databasePath}.import-${Date.now()}`
    await mkdir(path.dirname(databasePath), { recursive: true })
    await writeFile(temporaryPath, contents)
    await prisma.$disconnect()
    await copyFile(temporaryPath, databasePath)
    await unlink(temporaryPath)
    await configureDatabase(databasePath)
    return Response.json({ path: databasePath, imported: true, configured: true })
  }

  const body = await request.json() as { path?: unknown; initialize?: boolean }
  if (body.initialize === true) {
    const databasePath = getDatabasePath()
    await prisma.$disconnect()
    await rm(databasePath, { force: true })
    await mkdir(path.dirname(databasePath), { recursive: true })
    const prismaCli = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js')
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    await promisify(execFile)(process.execPath, [prismaCli, 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${databasePath}` },
    })
    await configureDatabase(databasePath)
    return Response.json({ path: databasePath, configured: true })
  }
  return Response.json({ error: 'Indica si quieres importar o crear una base de datos.' }, { status: 400 })
}
