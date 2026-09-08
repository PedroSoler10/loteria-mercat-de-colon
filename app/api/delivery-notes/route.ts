import crypto from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { prisma } from '@/lib/prisma'
import { parseDeliveryNoteItems, type PdfTextItem } from '@/lib/delivery-note-parser'

export const dynamic = 'force-dynamic'

function buildFractions(fractions?: string[]) {
  return fractions?.length
    ? fractions
    : Array.from({ length: 10 }, (_, index) => String(index + 1).padStart(2, '0'))
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
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs'),
    ).href
    const document = await getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false }).promise
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
  const relativePath = path.join('data', 'albaranes', `${parsed.sourceId}.pdf`)
  const absoluteDirectory = path.join(process.cwd(), 'data', 'albaranes')
  const absolutePath = path.join(process.cwd(), relativePath)
  const existing = await prisma.origen.findFirst({
    where: { OR: [{ idOrigen: parsed.sourceId }, { pdfChecksum: checksum }] },
  })
  if (existing) {
    if (existing.idOrigen === parsed.sourceId && existing.deletedAt && existing.pdfChecksum === checksum) {
      await prisma.origen.update({
        where: { idOrigen: existing.idOrigen },
        data: {
          deletedAt: null,
          nombreAlbaran: parsed.name,
          pdfPath: relativePath,
          pdfChecksum: checksum,
        },
      })
      return Response.json({
        idOrigen: existing.idOrigen,
        nombre: parsed.name,
        totalBoletos: await prisma.boleto.count({ where: { idOrigen: existing.idOrigen } }),
        restored: true,
      })
    }
    return Response.json({ error: `El albarán ${parsed.sourceId} ya está cargado` }, { status: 409 })
  }

  try {
    await mkdir(absoluteDirectory, { recursive: true })
    await writeFile(absolutePath, buffer)

    const result = await prisma.$transaction(async (tx) => {
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
            nombreSorteo: `Sorteo ${String(parsed.drawNumber).padStart(3, '0')}`,
            precioCentimos: 0,
          },
        })
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

      const duplicates = await tx.boleto.findMany({
        where: { OR: data.map((ticket) => ({ idSorteo: ticket.idSorteo, numeroJugado: ticket.numeroJugado, serie: ticket.serie, fraccion: ticket.fraccion })) },
        select: { numeroJugado: true, serie: true, fraccion: true },
      })
      if (duplicates.length > 0) {
        const first = duplicates[0]
        throw new Error(`El boleto ya está cargado: ${first.numeroJugado} / serie ${first.serie} / fracción ${first.fraccion}`)
      }

      await tx.origen.create({
        data: {
          idOrigen: parsed.sourceId,
          tipoOrigen: 'Albarán',
          nombreAlbaran: parsed.name,
          pdfPath: relativePath,
          pdfChecksum: checksum,
        },
      })
      await tx.boleto.createMany({ data })
      return { idOrigen: parsed.sourceId, nombre: parsed.name, totalBoletos: data.length }
    }, { timeout: 60_000 })

    return Response.json(result, { status: 201 })
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined)
    return Response.json({ error: error instanceof Error ? error.message : 'No se pudo guardar el albarán' }, { status: 409 })
  }
}
