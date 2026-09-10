import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
const DEFAULT_TICKET_PRICE_CENTIMOS = 2000

type SalePatch = {
  fecha?: string
  numero?: string
  serie?: string
  fraccion?: string
}

function parseTicketId(value: string) {
  const [numeroJugado, serie, fraccion] = value.split('/')
  if (!numeroJugado || !serie || !fraccion) return null
  return { numeroJugado, serie, fraccion }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const patch = (await request.json()) as SalePatch
  const targetKey = patch.numero && patch.serie && patch.fraccion
    ? parseTicketId(`${patch.numero}/${patch.serie}/${patch.fraccion}`)
    : null

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.venta.findUnique({ where: { idBoleto: id } })
      if (!current || current.estado !== 'activa') throw new Error('La venta no existe o está anulada')

      const data: { fechaHoraVenta?: Date; idBoleto?: string } = {}
      if (patch.fecha) data.fechaHoraVenta = new Date(patch.fecha)
      if (targetKey) {
        const target = await tx.boleto.findFirst({ where: targetKey })
        if (!target) throw new Error('El boleto indicado no existe')
        const existing = await tx.venta.findUnique({ where: { idBoleto: target.idBoleto } })
        if (existing?.estado === 'activa' && target.idBoleto !== id) throw new Error('El boleto indicado ya está vendido')
        data.idBoleto = target.idBoleto
      }

      return tx.venta.update({
        where: { idBoleto: id },
        data,
        include: { boleto: { include: { sorteo: true } } },
      })
    })

    return Response.json({
      id: updated.idBoleto,
      fecha: updated.fechaHoraVenta.toISOString(),
      tipoJuego: String(updated.boleto.sorteo.tipoJuego),
      sorteo: updated.boleto.sorteo.nombreSorteo,
      anio: updated.boleto.sorteo.anoCompleto,
      numero: updated.boleto.numeroJugado,
      serie: updated.boleto.serie,
      fraccion: updated.boleto.fraccion,
      precio: (updated.boleto.sorteo.precioCentimos || DEFAULT_TICKET_PRICE_CENTIMOS) / 100,
      estado: updated.estado,
    })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'No se pudo editar la venta' }, { status: 409 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const current = await prisma.venta.findUnique({ where: { idBoleto: id } })
    if (!current) return Response.json({ error: 'La venta no existe' }, { status: 404 })
    if (current.estado !== 'activa') return Response.json({ error: 'La venta ya está anulada' }, { status: 409 })

    const venta = await prisma.venta.update({
      where: { idBoleto: id },
      data: {
        estado: 'anulada',
        fechaHoraAnulacion: new Date(),
        motivoAnulacion: 'Anulación manual desde TPV',
      },
    })
    return Response.json({ id: venta.idBoleto, estado: venta.estado })
  } catch {
    return Response.json({ error: 'La venta no existe' }, { status: 404 })
  }
}
