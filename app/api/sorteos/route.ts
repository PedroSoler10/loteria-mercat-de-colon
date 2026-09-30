import { createSorteo, listSorteos, SorteoError } from '@/lib/sorteos-config'

export const dynamic = 'force-dynamic'

function errorResponse(error: unknown) {
  if (error instanceof SorteoError) return Response.json({ error: error.message, ...error.extra }, { status: error.status })
  return Response.json({ error: error instanceof Error ? error.message : 'No se pudo procesar la solicitud' }, { status: 500 })
}

export async function GET() {
  try {
    return Response.json(await listSorteos())
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { tipoJuego?: unknown; anoCompleto?: unknown; numeroSorteo?: unknown; nombre?: unknown; precioCentimos?: unknown }
    const idSorteo = await createSorteo(body)
    return Response.json({ idSorteo }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
