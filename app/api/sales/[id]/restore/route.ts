import { prisma } from '@/lib/prisma'
import { restaurarVenta } from '@/lib/boleto-estado'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const restored = await prisma.$transaction(async (tx) => {
      const boleto = await tx.boleto.findUnique({
        where: { idBoleto: id },
        include: { origen: true },
      })
      if (!boleto || boleto.fechaHoraVenta === null) throw new Error('La venta no existe')
      if (boleto.estado !== 'disponible' || boleto.fechaHoraAnulacion === null) throw new Error('Solo se pueden revertir ventas anuladas')
      if (boleto.origen?.deletedAt) throw new Error('No se puede revertir una venta de una carga eliminada')

      return restaurarVenta(tx, id)
    })
    return Response.json({ id: restored.idBoleto, estado: 'activa' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo revertir la venta'
    return Response.json({ error: message }, { status: message === 'La venta no existe' ? 404 : 409 })
  }
}
