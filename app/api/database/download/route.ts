import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { getDatabasePath } from '@/lib/database-location'

export const dynamic = 'force-dynamic'

export async function GET() {
  const databasePath = getDatabasePath()
  const file = await stat(databasePath)
  if (!file.isFile()) return Response.json({ error: 'No existe la base de datos.' }, { status: 404 })
  return new Response(Readable.toWeb(createReadStream(databasePath)) as ReadableStream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="loteria-backup.db"',
    },
  })
}
