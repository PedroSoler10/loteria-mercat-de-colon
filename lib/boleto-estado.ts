import type { Prisma } from '@prisma/client'
import { buildSelaeBarcodeForSorteo, SELAE_CONTROL_DESCONOCIDO } from '@/lib/selae-barcode'

/**
 * Transiciones de estado de un boleto. Son la única vía para cambiar `estado`, de modo que
 * vendido y cedido no puedan coincidir ni quedar datos de venta o cesión sueltos.
 *
 * - `disponible`: en stock. Si tiene `fechaHoraAnulacion`, su última venta fue anulada y se
 *   conserva hasta que se vuelva a vender o ceder.
 * - `vendido`: venta activa (`fechaHoraVenta`).
 * - `cedido`: traspasado a otra administración (`fechaHoraCesion`, `idOrigenCesion`). Si antes
 *   estaba vendido y el usuario decide que en realidad es una cesión, la venta queda anulada.
 * - `idOrigen` nulo: aún no se ha recibido (su albarán de entrada no está cargado).
 */
type Tx = Prisma.TransactionClient

export class EstadoBoletoError extends Error {}

/** Algo que el usuario debe decidir antes de importar un albarán. La primera opción conserva lo que ya hay. */
export type ConflictoImportacion = {
  /** Qué se pregunta: vendido en una cesión, cedido por otro albarán u origen distinto en una recepción. */
  tipo: 'cesion_vendido' | 'cesion_cedido' | 'origen'
  idBoleto: string
  numeroJugado: string
  serie: string
  fraccion: string
  detalle: string
  opciones: { valor: string; etiqueta: string }[]
}

/** Decisiones del usuario: id del boleto -> `valor` de la opción elegida. */
export type DecisionesImportacion = Record<string, string>

export class ConflictosError extends EstadoBoletoError {
  constructor(readonly conflictos: ConflictoImportacion[]) {
    super(`Hay ${conflictos.length} boleto${conflictos.length === 1 ? '' : 's'} que requieren una decisión`)
  }
}

const SIN_VENTA = { fechaHoraVenta: null, fechaHoraAnulacion: null, motivoAnulacion: null } as const
const SIN_CESION = { fechaHoraCesion: null, idOrigenCesion: null } as const
const BLOQUE = 500

export type BoletoClave = { numeroJugado: string; serie: string; fraccion: string }
type BoletoConEstado = BoletoClave & { idBoleto: string; estado: string }

/** Boletos que tienen una venta, activa o anulada. */
export const CON_VENTA = { fechaHoraVenta: { not: null } } satisfies Prisma.BoletoWhereInput

export function etiquetaBoleto({ numeroJugado, serie, fraccion }: BoletoClave) {
  return `${numeroJugado} / serie ${serie} / fracción ${fraccion}`
}

export function ventaEstado(boleto: { estado: string }): 'activa' | 'anulada' {
  return boleto.estado === 'vendido' ? 'activa' : 'anulada'
}

export async function venderBoleto(
  tx: Tx,
  boleto: BoletoConEstado,
  fecha: Date,
  lectura?: { digitosControl: string; codigoBarrasRaw: string },
) {
  if (boleto.estado === 'cedido') throw new EstadoBoletoError(`El boleto está cedido y no se puede vender: ${etiquetaBoleto(boleto)}`)
  if (boleto.estado === 'vendido') throw new EstadoBoletoError(`El boleto ya está vendido: ${etiquetaBoleto(boleto)}`)
  return tx.boleto.update({
    where: { idBoleto: boleto.idBoleto },
    data: { estado: 'vendido', fechaHoraVenta: fecha, fechaHoraAnulacion: null, motivoAnulacion: null, ...lectura },
    include: { sorteo: true },
  })
}

export async function anularVenta(tx: Tx, idBoleto: string, motivo: string, fecha = new Date()) {
  return tx.boleto.update({
    where: { idBoleto },
    data: { estado: 'disponible', fechaHoraAnulacion: fecha, motivoAnulacion: motivo },
  })
}

export async function restaurarVenta(tx: Tx, idBoleto: string) {
  return tx.boleto.update({
    where: { idBoleto },
    data: { estado: 'vendido', fechaHoraAnulacion: null, motivoAnulacion: null },
  })
}

/** Elimina por completo la venta (activa o anulada). Un boleto vendido queda disponible; uno cedido sigue cedido. */
export async function liberarVenta(tx: Tx, idBoleto: string) {
  await tx.boleto.updateMany({ where: { idBoleto, estado: 'vendido' }, data: { estado: 'disponible' } })
  return tx.boleto.update({ where: { idBoleto }, data: SIN_VENTA })
}

/** Elimina las ventas de todos los boletos de un origen. Devuelve cuántas había. */
export async function liberarVentasDeOrigen(tx: Tx, idOrigen: string) {
  await tx.boleto.updateMany({ where: { idOrigen, estado: 'vendido' }, data: { estado: 'disponible' } })
  const { count } = await tx.boleto.updateMany({ where: { idOrigen, ...CON_VENTA }, data: SIN_VENTA })
  return count
}

/** Alta de un boleto que aún no se ha recibido (sin origen): se vende o se cede antes de cargar su albarán. */
export async function crearBoletoSinRecibir(
  tx: Tx,
  datos: { idSorteo: string; numeroJugado: string; serie: string; fraccion: string; digitosControl: string; codigoBarrasRaw: string },
) {
  return tx.boleto.create({
    data: { idBoleto: `${datos.idSorteo}-${datos.numeroJugado}-${datos.serie}-${datos.fraccion}`, idOrigen: null, ...datos },
  })
}

export type FilaCesion = { idBoleto: string; idSorteo: string; numeroJugado: string; serie: string; fraccion: string }

/**
 * Marca como cedidos los boletos de un albarán de cesión. Los que aún no existen se crean sin origen
 * (no recibidos). Si algún boleto ya está vendido, o ya fue cedido en otro albarán, no se decide por el
 * usuario: se lanza `ConflictosError` con la pregunta y se vuelve a llamar con sus `decisiones`.
 */
export async function aplicarCesiones(
  tx: Tx,
  filas: FilaCesion[],
  idOrigenCesion: string,
  decisiones: DecisionesImportacion = {},
  fecha = new Date(),
) {
  const existentes = new Map<string, BoletoConEstado & { idOrigenCesion: string | null; fechaHoraVenta: Date | null }>()
  for (let offset = 0; offset < filas.length; offset += BLOQUE) {
    const lote = await tx.boleto.findMany({
      where: { idBoleto: { in: filas.slice(offset, offset + BLOQUE).map((fila) => fila.idBoleto) } },
      select: { idBoleto: true, estado: true, numeroJugado: true, serie: true, fraccion: true, idOrigenCesion: true, fechaHoraVenta: true },
    })
    for (const boleto of lote) existentes.set(boleto.idBoleto, boleto)
  }

  const conflictos: ConflictoImportacion[] = []
  const omitir = new Set<string>()
  const conservarVenta = new Set<string>()
  for (const boleto of existentes.values()) {
    const decision = decisiones[boleto.idBoleto]
    if (boleto.estado === 'vendido') {
      if (decision === 'vendido') omitir.add(boleto.idBoleto)
      else if (decision === 'cedido') conservarVenta.add(boleto.idBoleto)
      else {
        conflictos.push({
          ...boleto,
          tipo: 'cesion_vendido',
          detalle: `Figura como vendido${boleto.fechaHoraVenta ? ` el ${boleto.fechaHoraVenta.toLocaleString('es-ES')}` : ''} y este albarán de cesión (${idOrigenCesion}) lo incluye.`,
          opciones: [
            { valor: 'vendido', etiqueta: 'Es una venta: dejarlo como vendido' },
            { valor: 'cedido', etiqueta: 'Es una cesión: marcarlo como cedido (la venta se anula)' },
          ],
        })
      }
    } else if (boleto.estado === 'cedido' && boleto.idOrigenCesion === idOrigenCesion) {
      omitir.add(boleto.idBoleto) // Reimportación del mismo albarán: ya está cedido por él.
    } else if (boleto.estado === 'cedido') {
      if (decision === boleto.idOrigenCesion) omitir.add(boleto.idBoleto)
      else if (decision !== idOrigenCesion) {
        conflictos.push({
          ...boleto,
          tipo: 'cesion_cedido',
          detalle: `Ya figura como cedido en el albarán ${boleto.idOrigenCesion} y este albarán (${idOrigenCesion}) también lo incluye.`,
          opciones: [
            { valor: boleto.idOrigenCesion ?? '', etiqueta: `Cedido por el albarán ${boleto.idOrigenCesion}` },
            { valor: idOrigenCesion, etiqueta: `Cedido por este albarán (${idOrigenCesion})` },
          ],
        })
      }
    }
  }
  if (conflictos.length > 0) throw new ConflictosError(conflictos)

  const aplicables = filas.filter((fila) => !omitir.has(fila.idBoleto))
  const aActualizar = aplicables.filter((fila) => existentes.has(fila.idBoleto) && !conservarVenta.has(fila.idBoleto)).map((fila) => fila.idBoleto)
  for (let offset = 0; offset < aActualizar.length; offset += BLOQUE) {
    await tx.boleto.updateMany({
      where: { idBoleto: { in: aActualizar.slice(offset, offset + BLOQUE) } },
      data: { estado: 'cedido', fechaHoraCesion: fecha, idOrigenCesion, ...SIN_VENTA },
    })
  }
  // Una venta que el usuario decide que era en realidad una cesión no se borra: queda anulada como rastro.
  const aConservar = [...conservarVenta]
  for (let offset = 0; offset < aConservar.length; offset += BLOQUE) {
    await tx.boleto.updateMany({
      where: { idBoleto: { in: aConservar.slice(offset, offset + BLOQUE) } },
      data: { estado: 'cedido', fechaHoraCesion: fecha, idOrigenCesion, fechaHoraAnulacion: fecha, motivoAnulacion: `Era una cesión (albarán ${idOrigenCesion})` },
    })
  }
  const nuevos = aplicables.filter((fila) => !existentes.has(fila.idBoleto))
  for (let offset = 0; offset < nuevos.length; offset += BLOQUE) {
    await tx.boleto.createMany({
      data: nuevos.slice(offset, offset + BLOQUE).map((fila) => ({
        ...fila,
        idOrigen: null,
        digitosControl: SELAE_CONTROL_DESCONOCIDO,
        // El albarán de cesión no trae el código de barras: se construye con los dígitos de control a 0000.
        codigoBarrasRaw: buildSelaeBarcodeForSorteo(fila.idSorteo, fila),
        estado: 'cedido',
        fechaHoraCesion: fecha,
        idOrigenCesion,
      })),
    })
  }
  return { cedidos: aplicables.length, sinRecibir: nuevos.length, omitidos: omitir.size }
}

/**
 * Deshace las cesiones de un albarán: los boletos no recibidos y sin venta se eliminan y el resto vuelve a
 * estar disponible (si eran una venta anulada por la cesión, esa venta se puede restaurar).
 */
export async function revertirCesionesDeOrigen(tx: Tx, idOrigenCesion: string) {
  await tx.boleto.deleteMany({ where: { idOrigenCesion, idOrigen: null, fechaHoraVenta: null } })
  await tx.boleto.updateMany({ where: { idOrigenCesion }, data: { estado: 'disponible', ...SIN_CESION } })
}
