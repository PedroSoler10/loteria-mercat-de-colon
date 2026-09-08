import crypto from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import { prisma } from '@/lib/prisma'
import { parseDeliveryNoteItems, type PdfTextItem } from '@/lib/delivery-note-parser'
import { isTemporaryOriginId } from '@/lib/origin-id'

export const dynamic = 'force-dynamic'

function buildFractions(fractions?: string[]) {
  return fractions?.length
    ? fractions
    : Array.from({ length: 10 }, (_, index) => String(index + 1).padStart(2, '0'))
}

const duplicateCheckBatchSize = 500

function buildCessionRows(parsed: ReturnType<typeof parseDeliveryNoteItems>, sorteoId: string, originId: string) {
  return parsed.entries.flatMap((entry) => {
    const fractions = buildFractions(entry.fractions)
    return Array.from({ length: entry.seriesTo - entry.seriesFrom + 1 }, (_, index) => entry.seriesFrom + index)
      .flatMap((serie) => fractions.map((fraccion) => {
        const paddedSerie = String(serie).padStart(3, '0')
        const idBoleto = `${sorteoId}-${entry.number}-${paddedSerie}-${fraccion}`
        return {
          idCedido: `${originId}-${idBoleto}`,
          idBoleto,
          idSorteo: sorteoId,
          idOrigen: originId,
          numeroJugado: entry.number,
          serie: paddedSerie,
          fraccion,
        }
      }))
  })
}

export async function POST(request: Request) {
  const formData = await request.formData()
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
      const updated = await prisma.$transaction(async (tx) => {
        const origin = await tx.origen.update({
          where: { idOrigen: existing.idOrigen },
          data: {
            nombreAlbaran: parsed.name,
            tipoOrigen: parsed.originType,
            fechaEmision: parsed.emissionDate ? new Date(parsed.emissionDate) : null,
            totalNumeros: parsed.totalNumbers,
            totalSeries: parsed.totalSeries,
            totalBilletes: parsed.totalBilletes,
          },
        })
        if (parsed.originType === 'Cesión de Consignación') {
          const sorteoId = `${parsed.tipoJuego}${parsed.year}${String(parsed.drawNumber).padStart(3, '0')}`
          const cessionRows = buildCessionRows(parsed, sorteoId, existing.idOrigen)
          const requestedIds = cessionRows.map((row) => row.idBoleto)
          const boletos = []
          for (let offset = 0; offset < requestedIds.length; offset += duplicateCheckBatchSize) {
            const batch = requestedIds.slice(offset, offset + duplicateCheckBatchSize)
            boletos.push(...await tx.boleto.findMany({ where: { idBoleto: { in: batch } }, select: { idBoleto: true } }))
          }
          const receivedIds = new Set(boletos.map((boleto) => boleto.idBoleto))
          await tx.cedido.deleteMany({ where: { idOrigen: existing.idOrigen } })
          await tx.cedido.createMany({ data: cessionRows.map((row) => ({ ...row, idBoleto: receivedIds.has(row.idBoleto) ? row.idBoleto : null })) })
        }
        return origin
      })
      return Response.json({
        idOrigen: updated.idOrigen,
        nombre: updated.nombreAlbaran,
        tipoOrigen: updated.tipoOrigen,
        updated: true,
      })
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
        const salesCount = await tx.venta.count({ where: { boleto: { is: { idOrigen: previousOrigin.idOrigen } } } })
        if (salesCount > 0) throw new Error('El albarán eliminado tiene ventas asociadas y no se puede volver a importar')
        await tx.boleto.deleteMany({ where: { idOrigen: previousOrigin.idOrigen } })
        await tx.origen.delete({ where: { idOrigen: previousOrigin.idOrigen } })
      }

      let sorteo = await tx.sorteo.findUnique({
        where: { tipoJuego_anoCompleto_numeroSorteo: { tipoJuego: parsed.tipoJuego, anoCompleto: parsed.year, numeroSorteo: parsed.drawNumber } },
      })
      if (!sorteo) {
        const idSorteo = `${parsed.tipoJuego}${parsed.year}${String(parsed.drawNumber).padStart(3, '0')}`
        sorteo = await tx.sorteo.create({
          data: {
            idSorteo,
            tipoJuego: parsed.tipoJuego,
            anoEmision: parsed.year % 10,
            anoCompleto: parsed.year,
            numeroSorteo: parsed.drawNumber,
            nombreSorteo: parsed.drawName,
            precioCentimos: 0,
          },
        })
      } else if (sorteo.nombreSorteo !== parsed.drawName) {
        sorteo = await tx.sorteo.update({ where: { idSorteo: sorteo.idSorteo }, data: { nombreSorteo: parsed.drawName } })
      }

      const data = parsed.entries.flatMap((entry) => {
        const tickets = []
        for (let serie = entry.seriesFrom; serie <= entry.seriesTo; serie += 1) {
          for (const fraccion of buildFractions(entry.fractions)) {
            tickets.push({
              idBoleto: `${sorteo.idSorteo}-${entry.number}-${String(serie).padStart(3, '0')}-${fraccion}`,
              idSorteo: sorteo.idSorteo,
              idOrigen: parsed.sourceId,
              numeroJugado: entry.number,
              serie: String(serie).padStart(3, '0'),
              fraccion,
              digitosControl: '0000',
              codigoBarrasRaw: `PDF:${parsed.sourceId}`,
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
        duplicates.filter((ticket) => ticket.origen.deletedAt).map((ticket) => ticket.idOrigen),
      ))
      const purgedOriginIds: string[] = []
      for (const staleOriginId of staleOriginIds) {
        const salesCount = await tx.venta.count({ where: { boleto: { is: { idOrigen: staleOriginId } } } })
        if (salesCount === 0) {
          await tx.boleto.deleteMany({ where: { idOrigen: staleOriginId } })
          await tx.origen.delete({ where: { idOrigen: staleOriginId } })
          purgedOriginIds.push(staleOriginId)
        }
      }

      const activeDuplicates = duplicates.filter((ticket) => !purgedOriginIds.includes(ticket.idOrigen))
      const provisionalDuplicates = activeDuplicates.filter((ticket) => isTemporaryOriginId(ticket.idOrigen))
      const provisionalDuplicateIds = new Set(provisionalDuplicates.map((ticket) => ticket.idBoleto))
      const isConsignmentTransfer = parsed.originType === 'Cesión de Consignación'
      const blockingDuplicates = activeDuplicates.filter((ticket) => !isTemporaryOriginId(ticket.idOrigen))
      if (blockingDuplicates.length > 0 && !isConsignmentTransfer) {
        const first = blockingDuplicates[0]
        throw new Error(`El boleto ya está cargado: ${first.numeroJugado} / serie ${first.serie} / fracción ${first.fraccion}`)
      }

      const ticketsToCreate = isConsignmentTransfer
        ? []
        : data.filter((ticket) => !provisionalDuplicateIds.has(ticket.idBoleto))

      await tx.origen.create({
        data: {
          idOrigen: parsed.sourceId,
          idSorteo: sorteo.idSorteo,
          idReceptorAdmin: parsed.receiverAdminId,
          tipoOrigen: parsed.originType,
          nombreAlbaran: parsed.name,
          fechaEmision: parsed.emissionDate ? new Date(parsed.emissionDate) : null,
          totalNumeros: parsed.totalNumbers,
          totalSeries: parsed.totalSeries,
          totalBilletes: parsed.totalBilletes,
          pdfPath: relativePath,
          pdfChecksum: checksum,
        },
      })
      if (provisionalDuplicates.length > 0) {
        const provisionalOriginIds = Array.from(new Set(provisionalDuplicates.map((ticket) => ticket.idOrigen)))
        await tx.boleto.updateMany({
          where: { idBoleto: { in: Array.from(provisionalDuplicateIds) } },
          data: { idOrigen: parsed.sourceId },
        })
        for (const provisionalOriginId of provisionalOriginIds) {
          const remaining = await tx.boleto.count({ where: { idOrigen: provisionalOriginId } })
          if (remaining === 0) await tx.origen.delete({ where: { idOrigen: provisionalOriginId } })
        }
      }
      await tx.boleto.createMany({ data: ticketsToCreate })
      if (isConsignmentTransfer) {
        const receivedIds = new Set(activeDuplicates.map((ticket) => ticket.idBoleto))
        const cessionRows = buildCessionRows(parsed, sorteo.idSorteo, parsed.sourceId)
        await tx.cedido.createMany({
          data: cessionRows.map((row) => ({ ...row, idBoleto: receivedIds.has(row.idBoleto) ? row.idBoleto : null })),
        })
      }
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
    return Response.json({ error: error instanceof Error ? error.message : 'No se pudo guardar el albarán' }, { status: 409 })
  }
}
