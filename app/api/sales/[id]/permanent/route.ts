import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const sale = await prisma.venta.findUnique({ where: { idBoleto: id } })
    if (!sale) return Response.json({ error: 'La venta no existe' }, { status: 404 })
    if (sale.estado !== 'anulada') return Response.json({ error: 'Solo se pueden borrar definitivamente ventas anuladas' }, { status: 409 })

    await prisma.venta.delete({ where: { idBoleto: id } })
    return Response.json({ id, deleted: true })
  } catch {
    return Response.json({ error: 'No se pudo borrar definitivamente la venta' }, { status: 409 })
  }
}
