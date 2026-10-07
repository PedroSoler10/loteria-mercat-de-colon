import { prisma } from '@/lib/prisma'
import { anularVenta, liberarVenta, venderBoleto } from '@/lib/boleto-estado'
import { toSale } from '@/lib/sale-dto'

export const dynamic = 'force-dynamic'

type SalePatch = {
  fecha?: string
  numero?: string
  serie?: string
  fraccion?: string
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const patch = (await request.json()) as SalePatch
  const hasTarget = Boolean(patch.numero && patch.serie && patch.fraccion)

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.boleto.findUnique({ where: { idBoleto: id } })
      if (!current || current.estado !== 'vendido') throw new Error('La venta no existe o está anulada')

      const fecha = patch.fecha ? new Date(patch.fecha) : current.fechaHoraVenta ?? new Date()
      const target = hasTarget
        ? await tx.boleto.findFirst({ where: { idSorteo: current.idSorteo, numeroJugado: patch.numero!, serie: patch.serie!, fraccion: patch.fraccion! } })
        : current
      if (!target) throw new Error('El boleto indicado no existe')

      if (target.idBoleto === id) {
        return tx.boleto.update({ where: { idBoleto: id }, data: { fechaHoraVenta: fecha }, include: { sorteo: true } })
      }
      // La venta se traslada al otro boleto. Si el destino está vendido o cedido, venderBoleto lo rechaza.
      if (target.estado === 'vendido') throw new Error('El boleto indicado ya está vendido')
      await liberarVenta(tx, id)
      return venderBoleto(tx, target, fecha)
    })

    return Response.json(toSale(updated))
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'No se pudo editar la venta' }, { status: 409 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const current = await prisma.boleto.findUnique({ where: { idBoleto: id } })
    if (!current || current.fechaHoraVenta === null) return Response.json({ error: 'La venta no existe' }, { status: 404 })
    if (current.estado !== 'vendido') return Response.json({ error: 'La venta ya está anulada' }, { status: 409 })

    const boleto = await prisma.$transaction((tx) => anularVenta(tx, id, 'Anulación manual desde TPV'))
    return Response.json({ id: boleto.idBoleto, estado: 'anulada' })
  } catch {
    return Response.json({ error: 'La venta no existe' }, { status: 404 })
  }
}
