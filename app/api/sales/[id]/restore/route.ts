import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const restored = await prisma.$transaction(async (tx) => {
      const sale = await tx.venta.findUnique({
        where: { idBoleto: id },
        include: { boleto: { include: { origen: true } } },
      })
      if (!sale) throw new Error('La venta no existe')
      if (sale.estado !== 'anulada') throw new Error('Solo se pueden revertir ventas anuladas')
      if (sale.boleto.origen.deletedAt) throw new Error('No se puede revertir una venta de una carga eliminada')

      return tx.venta.update({
        where: { idBoleto: id },
        data: { estado: 'activa', fechaHoraAnulacion: null, motivoAnulacion: null },
      })
    })
    return Response.json({ id: restored.idBoleto, estado: restored.estado })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo revertir la venta'
    return Response.json({ error: message }, { status: message === 'La venta no existe' ? 404 : 409 })
  }
}
