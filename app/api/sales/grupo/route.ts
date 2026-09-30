import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type GroupPatch = {
  ids?: string[]
  fecha?: string
  numero?: string
  serie?: string
  fracciones?: number[]
  overwrite?: boolean
}

type Conflict = { fecha: string; numero: string; serie: string; fraccion: string; estado: string }

class GroupConflictError extends Error {
  constructor(readonly conflicts: Conflict[]) {
    super('Alguna fracción de destino ya tiene una venta registrada')
  }
}

/**
 * Edita a la vez un grupo de ventas activas del mismo número y serie vendidas en el mismo minuto:
 * fecha y hora, número, serie y rango de fracciones.
 * Las fracciones que se quitan del rango se anulan (reversible) y las que se añaden se registran como vendidas.
 */
export async function PATCH(request: Request) {
  const patch = (await request.json()) as GroupPatch
  const ids = patch.ids ?? []
  if (ids.length === 0) return Response.json({ error: 'No se han recibido ventas' }, { status: 400 })
  const newDate = patch.fecha ? new Date(patch.fecha) : null
  if (newDate && Number.isNaN(newDate.getTime())) return Response.json({ error: 'La fecha no es válida' }, { status: 400 })
  const requested = patch.fracciones ? [...new Set(patch.fracciones)].sort((a, b) => a - b) : null
  if (requested && (requested.length === 0 || requested.some((n) => !Number.isInteger(n) || n < 1 || n > 99))) {
    return Response.json({ error: 'Las fracciones indicadas no son válidas' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sources = await tx.venta.findMany({ where: { idBoleto: { in: ids } }, include: { boleto: true } })
      if (sources.length !== ids.length) throw new Error('Alguna venta ya no existe')
      if (sources.some((sale) => sale.estado !== 'activa')) throw new Error('Solo se pueden editar ventas activas')

      const first = sources[0].boleto
      const width = first.fraccion.length
      const numero = patch.numero?.trim() || first.numeroJugado
      const serie = patch.serie?.trim() || first.serie
      const oldFractions = sources.map((sale) => sale.boleto.fraccion)
      const newFractions = requested ? requested.map((n) => String(n).padStart(width, '0')) : [...oldFractions]

      const kept = sources.filter((sale) => newFractions.includes(sale.boleto.fraccion))
      const dropped = sources.filter((sale) => !newFractions.includes(sale.boleto.fraccion))
      const added = newFractions.filter((fraccion) => !oldFractions.includes(fraccion))

      const moves: { sourceId: string | null; seconds: [number, number]; targetId: string; existing: boolean }[] = []
      const conflicts: Conflict[] = []
      const plan = [
        ...kept.map((sale) => ({ sourceId: sale.idBoleto, fraccion: sale.boleto.fraccion, seconds: [sale.fechaHoraVenta.getSeconds(), sale.fechaHoraVenta.getMilliseconds()] as [number, number] })),
        ...added.map((fraccion) => ({ sourceId: null, fraccion, seconds: [0, 0] as [number, number] })),
      ]
      for (const item of plan) {
        const target = await tx.boleto.findFirst({
          where: { idSorteo: first.idSorteo, numeroJugado: numero, serie, fraccion: item.fraccion },
        })
        if (!target) throw new Error(`El boleto ${numero}/${serie}/${item.fraccion} no existe`)
        const existing = target.idBoleto !== item.sourceId
          ? await tx.venta.findUnique({ where: { idBoleto: target.idBoleto } })
          : null
        if (existing) {
          conflicts.push({ fecha: existing.fechaHoraVenta.toISOString(), numero, serie, fraccion: target.fraccion, estado: existing.estado })
        }
        moves.push({ sourceId: item.sourceId, seconds: item.seconds, targetId: target.idBoleto, existing: Boolean(existing) })
      }

      if (conflicts.length > 0 && !patch.overwrite) throw new GroupConflictError(conflicts)

      // Primero se liberan las ventas que se sobrescriben y las fracciones quitadas; después se mueven o crean las demás.
      for (const move of moves) {
        if (move.existing) await tx.venta.delete({ where: { idBoleto: move.targetId } })
      }
      for (const sale of dropped) {
        await tx.venta.update({
          where: { idBoleto: sale.idBoleto },
          data: { estado: 'anulada', fechaHoraAnulacion: new Date(), motivoAnulacion: 'Fracción quitada al editar el rango desde TPV' },
        })
      }
      for (const move of moves) {
        const fecha = newDate ? new Date(newDate) : null
        fecha?.setSeconds(move.seconds[0], move.seconds[1])
        if (move.sourceId === null) {
          await tx.venta.create({ data: { idBoleto: move.targetId, fechaHoraVenta: fecha ?? new Date(), estado: 'activa' } })
          continue
        }
        const data: { fechaHoraVenta?: Date; idBoleto?: string } = {}
        if (fecha) data.fechaHoraVenta = fecha
        if (move.targetId !== move.sourceId) data.idBoleto = move.targetId
        if (Object.keys(data).length > 0) await tx.venta.update({ where: { idBoleto: move.sourceId }, data })
      }
      return { updated: kept.length, added: added.length, annulled: dropped.length, overwritten: conflicts.length }
    })
    return Response.json(result)
  } catch (error) {
    if (error instanceof GroupConflictError) {
      return Response.json({ error: error.message, conflicts: error.conflicts }, { status: 409 })
    }
    return Response.json({ error: error instanceof Error ? error.message : 'No se pudo editar el grupo de ventas' }, { status: 409 })
  }
}
