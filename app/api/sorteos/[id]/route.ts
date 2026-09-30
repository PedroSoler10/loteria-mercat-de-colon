import { SorteoError, updateSorteo } from '@/lib/sorteos-config'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params
  try {
    const body = await request.json() as { nombre?: unknown; precioCentimos?: unknown; confirmarPrecio?: boolean }
    await updateSorteo(id, body)
    return Response.json({ idSorteo: id })
  } catch (error) {
    if (error instanceof SorteoError) return Response.json({ error: error.message, ...error.extra }, { status: error.status })
    return Response.json({ error: error instanceof Error ? error.message : 'No se pudo modificar el sorteo' }, { status: 500 })
  }
}
