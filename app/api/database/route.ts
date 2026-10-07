import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { prisma } from '@/lib/prisma'
import { configureDatabase, getConfiguredDatabasePath, getDatabasePath, isDatabaseConfigured } from '@/lib/database-location'

export const dynamic = 'force-dynamic'

// Aplica a una base de datos las migraciones pendientes (crea el esquema o actualiza una estructura antigua).
async function migrateDatabase(databasePath: string) {
  const prismaCli = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js')
  await promisify(execFile)(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: `file:${databasePath}` },
    maxBuffer: 1024 * 1024,
  })
}

function migrationErrorMessage(error: unknown) {
  const { stderr, stdout, message } = error as { stderr?: string; stdout?: string; message?: string }
  const text = `${stderr ?? ''}\n${stdout ?? ''}\n${message ?? ''}`
  if (text.includes('ABORTADO_hay_boletos_vendidos_y_cedidos')) {
    return 'Hay boletos vendidos y cedidos a la vez, o cedidos por varios albaranes. Resuélvelo con la versión anterior de la aplicación (anula la venta o elimina el albarán de cesión que sobra) y vuelve a importarla. Se ha conservado la base de datos anterior.'
  }
  return text.trim().split(/\r?\n/).filter(Boolean).slice(-4).join(' ') || 'Error desconocido.'
}
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
    const backupPath = `${databasePath}.antes-de-importar`
    await mkdir(path.dirname(databasePath), { recursive: true })
    await writeFile(temporaryPath, contents)
    await prisma.$disconnect()
    const hadDatabase = existsSync(databasePath)
    if (hadDatabase) await copyFile(databasePath, backupPath)
    await copyFile(temporaryPath, databasePath)
    await unlink(temporaryPath)
    // Una base con la estructura antigua se actualiza al importarla. Si la migración falla (por ejemplo, por
    // datos contradictorios) se restaura la base anterior para no dejar la aplicación con una base a medias.
    try {
      await migrateDatabase(databasePath)
    } catch (error) {
      if (hadDatabase) await copyFile(backupPath, databasePath)
      else await rm(databasePath, { force: true })
      return Response.json({ error: `No se pudo actualizar la base de datos importada. ${migrationErrorMessage(error)}` }, { status: 409 })
    }
    await configureDatabase(databasePath)
    return Response.json({ path: databasePath, imported: true, configured: true, backup: hadDatabase ? backupPath : null })
  }

  const body = await request.json() as { path?: unknown; initialize?: boolean }
  if (body.initialize === true) {
    const databasePath = getDatabasePath()
    await prisma.$disconnect()
    await rm(databasePath, { force: true })
    await mkdir(path.dirname(databasePath), { recursive: true })
    await migrateDatabase(databasePath)
    await configureDatabase(databasePath)
    return Response.json({ path: databasePath, configured: true })
  }
  return Response.json({ error: 'Indica si quieres importar o crear una base de datos.' }, { status: 400 })
}
