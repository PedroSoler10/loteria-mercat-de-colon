import crypto from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import { prisma } from '@/lib/prisma'
import { parseDeliveryNoteItems, type PdfTextItem } from '@/lib/delivery-note-parser'
import { isTemporaryOriginId } from '@/lib/origin-id'
import { buildSelaeBarcodeForSorteo, SELAE_CONTROL_DESCONOCIDO } from '@/lib/selae-barcode'
import { ensureSorteo } from '@/lib/sorteos-config'
import { aplicarCesiones, ConflictosError, CON_VENTA, type ConflictoImportacion, type DecisionesImportacion, type FilaCesion } from '@/lib/boleto-estado'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

function buildFractions(fractions?: string[]) {
  return fractions?.length
    ? fractions
    : Array.from({ length: 10 }, (_, index) => String(index + 1).padStart(2, '0'))
}

const duplicateCheckBatchSize = 500

function buildCessionRows(parsed: ReturnType<typeof parseDeliveryNoteItems>, sorteoId: string): FilaCesion[] {
  return parsed.entries.flatMap((entry) => {
    const fractions = buildFractions(entry.fractions)
    return Array.from({ length: entry.seriesTo - entry.seriesFrom + 1 }, (_, index) => entry.seriesFrom + index)
      .flatMap((serie) => fractions.map((fraccion) => {
        const paddedSerie = String(serie).padStart(3, '0')
        return {
          idBoleto: `${sorteoId}-${entry.number}-${paddedSerie}-${fraccion}`,
          idSorteo: sorteoId,
          numeroJugado: entry.number,
          serie: paddedSerie,
          fraccion,
        }
      }))
  })
}

// Boletos de un origen que ya tienen una venta o una cesión y, por tanto, no se pueden depurar.
function countBusyTickets(tx: Prisma.TransactionClient, idOrigen: string) {
  return tx.boleto.count({ where: { idOrigen, OR: [CON_VENTA, { estado: 'cedido' }] } })
}

// Respuestas del usuario a las preguntas de una importación anterior (id del boleto -> opción elegida).
function parseDecisiones(value: FormDataEntryValue | null): DecisionesImportacion {
  if (typeof value !== 'string') return {}
  try {
    const data = JSON.parse(value) as unknown
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    return Object.fromEntries(Object.entries(data).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  } catch {
    return {}
  }
}

function conflictResponse(error: ConflictosError) {
  return Response.json({ error: error.message, conflictos: error.conflictos }, { status: 409 })
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const decisiones = parseDecisiones(formData.get('decisiones'))
  const file = formData.get('file')
  if (!(file instanceof File) || file.type !== 'application/pdf') {
    return Response.json({ error: 'Selecciona un archivo PDF válido' }, { status: 400 })
  }
  if (file.size > 25 * 1024 * 1024) {
    return Response.json({ error: 'El PDF no puede superar los 25 MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let parsed: ReturnType<typeof parseDeliveryNoteItems>
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const standardFontDataUrl = `${path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts').replaceAll('\\', '/')}/`
    const document = await getDocument({
      data: new Uint8Array(buffer),
      standardFontDataUrl,
      useWorkerFetch: false,
    }).promise
    const items: PdfTextItem[] = []
    const pageTexts: string[] = []
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        const content = await page.getTextContent()
        const pageItems = content.items as Array<{ str?: string; transform?: number[] }>
        pageTexts.push(pageItems.map((item) => item.str ?? '').join('\n'))
        for (const item of pageItems) {
          if (item.str && item.transform) items.push({ text: item.str, x: item.transform[4], y: item.transform[5], page: pageNumber })
        }
      }
      parsed = parseDeliveryNoteItems(pageTexts.join('\n'), items, file.name)
    } finally {
      await document.destroy()
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'No se pudo leer el PDF' }, { status: 422 })
  }

  const checksum = crypto.createHash('sha256').update(buffer).digest('hex')
  const existing = await prisma.origen.findFirst({
    where: { deletedAt: null, OR: [{ idOrigen: parsed.sourceId }, { pdfChecksum: checksum }] },
  })
  if (existing) {
    if (existing.pdfChecksum === checksum) {
      try {
        const updated = await prisma.$transaction(async (tx) => {
          const origin = await tx.origen.update({
            where: { idOrigen: existing.idOrigen },
            data: {
              tipoOrigen: parsed.originType,
              fechaEmision: parsed.emissionDate ? new Date(parsed.emissionDate) : null,
              totalNumeros: parsed.totalNumbers,
              totalSeries: parsed.totalSeries,
              totalBilletes: parsed.totalBilletes,
            },
          })
          if (parsed.originType === 'Cesión de Consignación') {
            const sorteoId = `${parsed.tipoJuego}${parsed.year}${String(parsed.drawNumber).padStart(3, '0')}`
            // Los boletos que este albarán ya cedió se respetan; solo se preguntan los nuevos conflictos.
            await aplicarCesiones(tx, buildCessionRows(parsed, sorteoId), existing.idOrigen, decisiones)
          }
          return origin
        })
        return Response.json({
          idOrigen: updated.idOrigen,
          tipoOrigen: updated.tipoOrigen,
          updated: true,
        })
      } catch (error) {
        if (error instanceof ConflictosError) return conflictResponse(error)
        return Response.json({ error: error instanceof Error ? error.message : 'No se pudo actualizar el albarán' }, { status: 409 })
      }
    }
    return Response.json({ error: `El albarán ${parsed.sourceId} ya está cargado` }, { status: 409 })
  }

  const relativePath = path.join('data', 'albaranes', `${parsed.sourceId}.pdf`)
  const absoluteDirectory = path.join(process.cwd(), 'data', 'albaranes')
  const absolutePath = path.join(process.cwd(), relativePath)

  try {
    await mkdir(absoluteDirectory, { recursive: true })
    await writeFile(absolutePath, buffer)

    const result = await prisma.$transaction(async (tx) => {
      // Una eliminación desde la interfaz es lógica para conservar ventas. Si la
      // carga eliminada no tiene ventas, se puede depurar y volver a importar.
      const previousDeletedOrigins = await tx.origen.findMany({
        where: {
          deletedAt: { not: null },
          OR: [{ idOrigen: parsed.sourceId }, { pdfChecksum: checksum }],
        },
        select: { idOrigen: true },
      })
      for (const previousOrigin of previousDeletedOrigins) {
        if (await countBusyTickets(tx, previousOrigin.idOrigen) > 0) throw new Error('El albarán eliminado tiene ventas o cesiones asociadas y no se puede volver a importar')
        await tx.boleto.deleteMany({ where: { idOrigen: previousOrigin.idOrigen } })
        await tx.origen.delete({ where: { idOrigen: previousOrigin.idOrigen } })
      }

      // El sorteo se toma de sorteos.json; si el albarán trae uno nuevo se crea con lo leído.
      const sorteo = await ensureSorteo(tx, { tipoJuego: parsed.tipoJuego, anoCompleto: parsed.year, numeroSorteo: parsed.drawNumber }, { createIfUnknown: true })
      if (!sorteo) throw new Error('No se pudo determinar el sorteo del albarán')

      const data = parsed.entries.flatMap((entry) => {
        const tickets = []
        for (let serie = entry.seriesFrom; serie <= entry.seriesTo; serie += 1) {
          const paddedSerie = String(serie).padStart(3, '0')
          for (const fraccion of buildFractions(entry.fractions)) {
            tickets.push({
              idBoleto: `${sorteo.idSorteo}-${entry.number}-${paddedSerie}-${fraccion}`,
              idSorteo: sorteo.idSorteo,
              idOrigen: parsed.sourceId,
              numeroJugado: entry.number,
              serie: paddedSerie,
              fraccion,
              digitosControl: SELAE_CONTROL_DESCONOCIDO,
              // El albarán no trae el código de barras: se construye con los dígitos de control a 0000 hasta que se lea.
              codigoBarrasRaw: buildSelaeBarcodeForSorteo(sorteo.idSorteo, { fraccion, serie: paddedSerie, numeroJugado: entry.number }),
            })
          }
        }
        return tickets
      })

      const duplicates = []
      for (let offset = 0; offset < data.length; offset += duplicateCheckBatchSize) {
        const batch = data.slice(offset, offset + duplicateCheckBatchSize)
        const batchDuplicates = await tx.boleto.findMany({
          where: { OR: batch.map((ticket) => ({ idSorteo: ticket.idSorteo, numeroJugado: ticket.numeroJugado, serie: ticket.serie, fraccion: ticket.fraccion })) },
          include: { origen: { select: { deletedAt: true } } },
        })
        duplicates.push(...batchDuplicates)
      }
      const staleOriginIds = Array.from(new Set(
        duplicates.flatMap((ticket) => ticket.idOrigen !== null && ticket.origen?.deletedAt ? [ticket.idOrigen] : []),
      ))
      const purgedOriginIds: string[] = []
      for (const staleOriginId of staleOriginIds) {
        if (await countBusyTickets(tx, staleOriginId) === 0) {
          await tx.boleto.deleteMany({ where: { idOrigen: staleOriginId } })
          await tx.origen.delete({ where: { idOrigen: staleOriginId } })
          purgedOriginIds.push(staleOriginId)
        }
      }

      const isConsignmentTransfer = parsed.originType === 'Cesión de Consignación'
      const activeDuplicates = duplicates.filter((ticket) => ticket.idOrigen === null || !purgedOriginIds.includes(ticket.idOrigen))
      // Boletos que ya existen pero sin su albarán de entrada: sin origen (vendidos o cedidos antes de cargarlo)
      // o con un origen provisional (alta manual o por escáner). El albarán los adopta conservando su estado.
      const provisionalDuplicates = isConsignmentTransfer
        ? []
        : activeDuplicates.filter((ticket) => ticket.idOrigen === null || isTemporaryOriginId(ticket.idOrigen))
      const provisionalDuplicateIds = new Set(provisionalDuplicates.map((ticket) => ticket.idBoleto))
      // Un albarán de recepción con boletos que ya tienen otro origen real: se pregunta cuál es el correcto.
      // En un albarán de cesión estos boletos son justo los que se ceden, así que no hay conflicto.
      const blockingDuplicates = isConsignmentTransfer
        ? []
        : activeDuplicates.filter((ticket) => ticket.idOrigen !== null && !isTemporaryOriginId(ticket.idOrigen))
      const originConflicts: ConflictoImportacion[] = []
      const reassignedIds: string[] = []
      for (const ticket of blockingDuplicates) {
        const decision = decisiones[ticket.idBoleto]
        if (decision === parsed.sourceId) reassignedIds.push(ticket.idBoleto)
        else if (decision !== ticket.idOrigen) {
          originConflicts.push({
            tipo: 'origen',
            idBoleto: ticket.idBoleto,
            numeroJugado: ticket.numeroJugado,
            serie: ticket.serie,
            fraccion: ticket.fraccion,
            detalle: `Ya está cargado con el origen ${ticket.idOrigen} y este albarán (${parsed.sourceId}) también lo incluye.`,
            opciones: [
              { valor: ticket.idOrigen ?? '', etiqueta: `Mantener el origen actual (${ticket.idOrigen})` },
              { valor: parsed.sourceId, etiqueta: `Usar este albarán (${parsed.sourceId})` },
            ],
          })
        }
      }
      if (originConflicts.length > 0) throw new ConflictosError(originConflicts)
      const blockingDuplicateIds = new Set(blockingDuplicates.map((ticket) => ticket.idBoleto))

      const ticketsToCreate = isConsignmentTransfer
        ? []
        : data.filter((ticket) => !provisionalDuplicateIds.has(ticket.idBoleto) && !blockingDuplicateIds.has(ticket.idBoleto))

      await tx.origen.create({
        data: {
          idOrigen: parsed.sourceId,
          idSorteo: sorteo.idSorteo,
          idReceptorAdmin: parsed.receiverAdminId,
          tipoOrigen: parsed.originType,
          fechaEmision: parsed.emissionDate ? new Date(parsed.emissionDate) : null,
          totalNumeros: parsed.totalNumbers,
          totalSeries: parsed.totalSeries,
          totalBilletes: parsed.totalBilletes,
          pdfPath: relativePath,
          pdfChecksum: checksum,
        },
      })
      if (provisionalDuplicates.length > 0) {
        const provisionalOriginIds = Array.from(new Set(provisionalDuplicates.flatMap((ticket) => ticket.idOrigen !== null ? [ticket.idOrigen] : [])))
        await tx.boleto.updateMany({
          where: { idBoleto: { in: Array.from(provisionalDuplicateIds) } },
          data: { idOrigen: parsed.sourceId },
        })
        for (const provisionalOriginId of provisionalOriginIds) {
          const remaining = await tx.boleto.count({ where: { idOrigen: provisionalOriginId } })
          if (remaining === 0) await tx.origen.delete({ where: { idOrigen: provisionalOriginId } })
        }
      }
      if (reassignedIds.length > 0) {
        await tx.boleto.updateMany({ where: { idBoleto: { in: reassignedIds } }, data: { idOrigen: parsed.sourceId } })
      }
      await tx.boleto.createMany({ data: ticketsToCreate })
      if (isConsignmentTransfer) await aplicarCesiones(tx, buildCessionRows(parsed, sorteo.idSorteo), parsed.sourceId, decisiones)
      return {
        idOrigen: parsed.sourceId,
        idReceptorAdmin: parsed.receiverAdminId,
        tipoOrigen: parsed.originType,
        nombreSorteo: sorteo.nombreSorteo,
        totalNumeros: parsed.totalNumbers,
        totalSeries: parsed.totalSeries,
        totalBilletes: parsed.totalBilletes,
      }
    }, { maxWait: 10_000, timeout: 60_000 })

    return Response.json(result, { status: 201 })
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined)
    if (error instanceof ConflictosError) return conflictResponse(error)
    return Response.json({ error: error instanceof Error ? error.message : 'No se pudo guardar el albarán' }, { status: 409 })
  }
}
