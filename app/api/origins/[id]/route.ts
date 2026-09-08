import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params
  const body = (await request.json()) as { nombre?: string }
  const nombre = body.nombre?.trim()
  if (!nombre) return Response.json({ error: 'El nombre de la carga no puede estar vacío' }, { status: 400 })

  try {
    const origin = await prisma.origen.update({
      where: { idOrigen: id },
      data: { nombreAlbaran: nombre },
    })
    return Response.json({ idOrigen: origin.idOrigen, nombre: origin.nombreAlbaran })
  } catch {
    return Response.json({ error: 'La carga no existe' }, { status: 404 })
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params

  try {
    await prisma.$transaction(async (tx) => {
      const origin = await tx.origen.findUnique({ where: { idOrigen: id }, select: { idOrigen: true } })
      if (!origin) throw new Error('La carga no existe')

      const activeSales = await tx.venta.count({ where: { estado: 'activa', boleto: { is: { idOrigen: id } } } })
      if (activeSales > 0) throw new Error('No se puede eliminar una carga con ventas activas')

      await tx.origen.update({ where: { idOrigen: id }, data: { deletedAt: new Date() } })
    })
    return Response.json({ idOrigen: id, deleted: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar la carga'
    return Response.json({ error: message }, { status: message === 'La carga no existe' ? 404 : 409 })
  }
}