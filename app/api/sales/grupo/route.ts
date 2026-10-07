import { prisma } from '@/lib/prisma'
import { anularVenta, CON_VENTA, etiquetaBoleto, liberarVenta, venderBoleto, ventaEstado } from '@/lib/boleto-estado'

export const dynamic = 'force-dynamic'

type GroupPatch = {
  ids?: string[]
  fecha?: string
  numero?: string
  series?: number[]
  fracciones?: number[]
  overwrite?: boolean
}

type Conflict = { fecha: string; numero: string; serie: string; fraccion: string; estado: string }

class GroupConflictError extends Error {
  constructor(readonly conflicts: Conflict[]) {
    super('Alguna fracción de destino ya tiene una venta registrada')
  }
}

function validNumbers(values: number[] | undefined, min: number, max: number) {
  return !values || (values.length > 0 && values.every((n) => Number.isInteger(n) && n >= min && n <= max))
}

/**
 * Edita a la vez un grupo de ventas activas del mismo número vendidas en el mismo minuto (una o varias series):
 * fecha y hora, número, series y fracciones.
 * Las series antiguas y nuevas se emparejan por orden. Lo que sobra de las antiguas o de las fracciones se anula
 * (reversible) y lo que se añade se registra como vendido.
 */
export async function PATCH(request: Request) {
  const patch = (await request.json()) as GroupPatch
  const ids = patch.ids ?? []
  if (ids.length === 0) return Response.json({ error: 'No se han recibido ventas' }, { status: 400 })
  const newDate = patch.fecha ? new Date(patch.fecha) : null
  if (newDate && Number.isNaN(newDate.getTime())) return Response.json({ error: 'La fecha no es válida' }, { status: 400 })
  if (!validNumbers(patch.fracciones, 1, 99) || !validNumbers(patch.series, 0, 999)) {
    return Response.json({ error: 'Las series o fracciones indicadas no son válidas' }, { status: 400 })
  }
  const sourceIds = new Set(ids)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sources = await tx.boleto.findMany({ where: { idBoleto: { in: ids }, ...CON_VENTA } })
      if (sources.length !== ids.length) throw new Error('Alguna venta ya no existe')
      if (sources.some((sale) => sale.estado !== 'vendido')) throw new Error('Solo se pueden editar ventas activas')
      const saleDate = (sale: { fechaHoraVenta: Date | null }) => sale.fechaHoraVenta ?? new Date()

      const first = sources[0]
      const numero = patch.numero?.trim() || first.numeroJugado
      const serieWidth = first.serie.length
      const fraccionWidth = first.fraccion.length
      const pad = (n: number, width: number) => String(n).padStart(width, '0')

      const oldSeries = [...new Set(sources.map((sale) => sale.serie))].sort()
      const oldFractions = [...new Set(sources.map((sale) => sale.fraccion))].sort()
      const newSeries = patch.series ? [...new Set(patch.series)].sort((a, b) => a - b).map((n) => pad(n, serieWidth)) : oldSeries
      const newFractions = patch.fracciones ? [...new Set(patch.fracciones)].sort((a, b) => a - b).map((n) => pad(n, fraccionWidth)) : oldFractions

      type Item = { sourceId: string | null; serie: string; fraccion: string; fecha: Date }
      const items: Item[] = []
      const dropped: string[] = []
      const total = Math.max(oldSeries.length, newSeries.length)
      for (let index = 0; index < total; index += 1) {
        const oldSerie = oldSeries[index]
        const newSerie = newSeries[index]
        const oldSales = oldSerie ? sources.filter((sale) => sale.serie === oldSerie) : []
        for (const sale of oldSales) {
          if (newSerie && newFractions.includes(sale.fraccion)) {
            items.push({ sourceId: sale.idBoleto, serie: newSerie, fraccion: sale.fraccion, fecha: saleDate(sale) })
          } else {
            dropped.push(sale.idBoleto)
          }
        }
        if (newSerie) {
          const present = new Set(oldSales.map((sale) => sale.fraccion))
          for (const fraccion of newFractions) {
            if (!present.has(fraccion)) items.push({ sourceId: null, serie: newSerie, fraccion, fecha: newDate ?? saleDate(sources[0]) })
          }
        }
      }
      if (items.length === 0) throw new Error('No queda ninguna fracción por vender')

      const droppedSet = new Set(dropped)
      const targets: { item: Item; targetId: string }[] = []
      const conflicts: Conflict[] = []
      const overwrittenIds = new Set<string>()
      for (const item of items) {
        const target = await tx.boleto.findFirst({
          where: { idSorteo: first.idSorteo, numeroJugado: numero, serie: item.serie, fraccion: item.fraccion },
        })
        if (!target) throw new Error(`El boleto ${numero}/${item.serie}/${item.fraccion} no existe`)
        if (target.estado === 'cedido') throw new Error(`El boleto está cedido y no se puede vender: ${etiquetaBoleto(target)}`)
        // Una venta del propio grupo no es un conflicto: se mueve junto con las demás (salvo si se iba a anular).
        const existing = target.idBoleto !== item.sourceId && (!sourceIds.has(target.idBoleto) || droppedSet.has(target.idBoleto)) && target.fechaHoraVenta !== null
          ? target
          : null
        if (existing) {
          overwrittenIds.add(target.idBoleto)
          conflicts.push({ fecha: saleDate(existing).toISOString(), numero, serie: item.serie, fraccion: target.fraccion, estado: ventaEstado(existing) })
        }
        targets.push({ item, targetId: target.idBoleto })
      }
      if (conflicts.length > 0 && !patch.overwrite) throw new GroupConflictError(conflicts)

      // 1) Se liberan las ventas sobrescritas y las que cambian de boleto; 2) se anulan las fracciones o series quitadas;
      // 3) se registran las ventas en su sitio definitivo (así las series pueden desplazarse sin chocar entre sí).
      for (const { item, targetId } of targets) {
        if (overwrittenIds.has(targetId)) await liberarVenta(tx, targetId)
        if (item.sourceId && item.sourceId !== targetId) await liberarVenta(tx, item.sourceId)
      }
      for (const id of dropped.filter((droppedId) => !overwrittenIds.has(droppedId))) {
        await anularVenta(tx, id, 'Fracción quitada al editar el grupo desde TPV')
      }
      for (const { item, targetId } of targets) {
        const moved = item.sourceId !== null && item.sourceId !== targetId
        const created = item.sourceId === null
        const fecha = new Date(newDate ?? item.fecha)
        // Se conservan los segundos de cada fracción para no alterar el orden original.
        if (newDate && !created) fecha.setSeconds(item.fecha.getSeconds(), item.fecha.getMilliseconds())
        if (moved || created) {
          await venderBoleto(tx, await tx.boleto.findUniqueOrThrow({ where: { idBoleto: targetId } }), fecha)
        } else if (newDate) {
          await tx.boleto.update({ where: { idBoleto: targetId }, data: { fechaHoraVenta: fecha } })
        }
      }
      return {
        updated: targets.filter(({ item }) => item.sourceId !== null).length,
        added: targets.filter(({ item }) => item.sourceId === null).length,
        annulled: dropped.length,
        overwritten: conflicts.length,
      }
    })
    return Response.json(result)
  } catch (error) {
    if (error instanceof GroupConflictError) {
      return Response.json({ error: error.message, conflicts: error.conflicts }, { status: 409 })
    }
    return Response.json({ error: error instanceof Error ? error.message : 'No se pudo editar el grupo de ventas' }, { status: 409 })
  }
}
