import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const execFileAsync = promisify(execFile)

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: 'Selecciona un archivo de ventas .txt.' }, { status: 400 })
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'loteria-sales-'))
  const temporaryPath = path.join(temporaryDirectory, 'ventas.txt')
  try {
    await writeFile(temporaryPath, Buffer.from(await file.arrayBuffer()))
    const scriptPath = path.join(process.cwd(), 'scripts', 'import-sales.cjs')
    const result = await execFileAsync(process.execPath, [scriptPath, temporaryPath], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 1024 * 1024,
    })
    return Response.json({ output: result.stdout })
  } catch (reason) {
    const error = reason as { stderr?: string; stdout?: string; message?: string }
    return Response.json({ error: error.stderr?.trim() || error.message || 'No se pudieron importar las ventas.' }, { status: 400 })
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}
