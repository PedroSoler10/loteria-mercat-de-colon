import { prisma } from '@/lib/prisma'
import { liberarVenta } from '@/lib/boleto-estado'

export const dynamic = 'force-dynamic'

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const boleto = await prisma.boleto.findUnique({ where: { idBoleto: id } })
    if (!boleto || boleto.fechaHoraVenta === null) return Response.json({ error: 'La venta no existe' }, { status: 404 })
    // Solo ventas anuladas: un boleto disponible con anulación o uno cedido que conserva su venta anulada.
    if (boleto.estado === 'vendido' || boleto.fechaHoraAnulacion === null) return Response.json({ error: 'Solo se pueden borrar definitivamente ventas anuladas' }, { status: 409 })

    await prisma.$transaction((tx) => liberarVenta(tx, id))
    return Response.json({ id, deleted: true })
  } catch {
    return Response.json({ error: 'No se pudo borrar definitivamente la venta' }, { status: 409 })
  }
}
