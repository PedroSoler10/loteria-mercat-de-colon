import { prisma } from '@/lib/prisma'
import { parseSelaeBarcode } from '@/lib/selae-barcode'

export const dynamic = 'force-dynamic'

type ManualEntryRequest = {
  scan?: string
  tipoJuego?: string
  sorteo?: string
  anio?: string
  numero?: string
  serie?: string
  serieHasta?: string
  fraccion?: string
  isFullSeries?: boolean
}

function asNumber(value: string | undefined, name: string) {
  const number = Number(value)
  if (!Number.isInteger(number)) throw new Error(`${name} no es válido`)
  return number
}

function pad(value: string, length: number) {
  return value.padStart(length, '0')
}

function originId(date: Date, prefix: 'MAN' | 'SCAN') {
  const parts = [
    date.getFullYear(),
    pad(String(date.getMonth() + 1), 2),
    pad(String(date.getDate()), 2),
    pad(String(date.getHours()), 2),
    pad(String(date.getMinutes()), 2),
    pad(String(date.getSeconds()), 2),
  ]
  return `${prefix}_${parts.join('-')}`
}

export async function POST(request: Request) {
  const body = (await request.json()) as ManualEntryRequest
  const rawScan = body.scan?.trim() ?? ''
  let scanned: ReturnType<typeof parseSelaeBarcode> | null = null
  if (rawScan) {
    try {
      scanned = parseSelaeBarcode(rawScan)
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Código SELAE no válido' }, { status: 400 })
    }
  }

  const tipoJuego = scanned?.tipoJuego ?? asNumber(body.tipoJuego, 'El tipo de juego')
  const numeroSorteo = scanned?.numeroSorteo ?? asNumber(body.sorteo, 'El número de sorteo')
  const anoCompleto = asNumber(body.anio, 'El año')
  const numeroJugado = scanned?.numeroJugado ?? pad(body.numero?.trim() ?? '', 5)
  const serieDesde = scanned?.serie ?? pad(body.serie?.trim() ?? '', 3)
  const serieHasta = scanned ? serieDesde : pad(body.serieHasta?.trim() || serieDesde, 3)
  const fraccionValue = scanned?.fraccion ?? body.fraccion

  if (!/^\d{5}$/.test(numeroJugado)) return Response.json({ error: 'El número debe tener 5 cifras' }, { status: 400 })
  if (!/^\d{3}$/.test(serieDesde) || !/^\d{3}$/.test(serieHasta) || Number(serieDesde) > Number(serieHasta)) {
    return Response.json({ error: 'El rango de series no es válido' }, { status: 400 })
  }
  if (!body.isFullSeries && !/^\d{1,2}$/.test(fraccionValue ?? '')) {
    return Response.json({ error: 'La fracción debe tener entre 1 y 2 cifras' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sorteo = await tx.sorteo.findUnique({
        where: { tipoJuego_anoCompleto_numeroSorteo: { tipoJuego, anoCompleto, numeroSorteo } },
      })
      if (!sorteo) throw new Error('El sorteo no existe en la base de datos')

      const series = []
      for (let value = Number(serieDesde); value <= Number(serieHasta); value += 1) series.push(String(value).padStart(3, '0'))
      const fracciones = body.isFullSeries
        ? Array.from({ length: 10 }, (_, index) => String(index + 1).padStart(2, '0'))
        : [pad(fraccionValue!, 2)]
      const data = series.flatMap((serie) => fracciones.map((fraccion) => {
        const idBoleto = `${sorteo.idSorteo}-${numeroJugado}-${serie}-${fraccion}`
        const codigoBarrasRaw = rawScan || `${sorteo.idSorteo}${fraccion}${serie}${numeroJugado}`
        return {
          idBoleto,
          idSorteo: sorteo.idSorteo,
          numeroJugado,
          serie,
          fraccion,
          digitosControl: scanned?.digitosControl ?? '0000',
          codigoBarrasRaw,
        }
      }))

      const duplicates = []
      for (let offset = 0; offset < data.length; offset += 500) {
        const batch = data.slice(offset, offset + 500)
        const batchDuplicates = await tx.boleto.findMany({
          where: {
            OR: batch.map((boleto) => ({
              idSorteo: boleto.idSorteo,
              numeroJugado: boleto.numeroJugado,
              serie: boleto.serie,
              fraccion: boleto.fraccion,
            })),
          },
          include: { origen: true },
        })
        duplicates.push(...batchDuplicates)
      }
      const staleOriginIds = Array.from(new Set(
        duplicates.filter((boleto) => boleto.origen.deletedAt).map((boleto) => boleto.idOrigen),
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

      const remainingDuplicates = duplicates.filter((boleto) => !purgedOriginIds.includes(boleto.idOrigen))
      if (remainingDuplicates.length > 0) {
        const listed = remainingDuplicates
          .slice(0, 3)
          .map((boleto) => `${boleto.numeroJugado} / serie ${boleto.serie} / fracción ${boleto.fraccion}`)
          .join(', ')
        const suffix = remainingDuplicates.length > 3 ? ` y ${remainingDuplicates.length - 3} más` : ''
        throw new Error(`El boleto ya está cargado: ${listed}${suffix}`)
      }

      let originDate = new Date()
      const originPrefix = rawScan ? 'SCAN' : 'MAN'
      let idOrigen = originId(originDate, originPrefix)
      while (await tx.origen.findUnique({ where: { idOrigen } })) {
        originDate = new Date(originDate.getTime() + 1000)
        idOrigen = originId(originDate, originPrefix)
      }
      const origen = await tx.origen.create({
        data: {
          idOrigen,
          idSorteo: sorteo.idSorteo,
          tipoOrigen: rawScan ? 'Escaner' : 'Manual',
          nombreAlbaran: rawScan ? 'Alta mediante lectura' : 'Alta manual',
          fechaEmision: originDate,
          totalNumeros: 1,
          totalSeries: series.length,
          totalBilletes: data.length,
          pdfPath: null,
          pdfChecksum: null,
        },
      })
      const tickets = data.map((boleto) => ({ ...boleto, idOrigen: origen.idOrigen }))

      await tx.boleto.createMany({ data: tickets })
      return { originId: origen.idOrigen, count: tickets.length }
    })

    return Response.json(result, { status: 201 })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'No se pudo dar de alta el boleto' }, { status: 409 })
  }
}
