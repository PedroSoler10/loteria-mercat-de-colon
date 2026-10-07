import { prisma } from '@/lib/prisma'
import { buildSelaeBarcodeForSorteo, parseSelaeBarcode, SELAE_CONTROL_DESCONOCIDO, type SelaeBarcode } from '@/lib/selae-barcode'
import { findSorteoForScan } from '@/lib/sorteos-config'
import { CON_VENTA, crearBoletoSinRecibir, venderBoleto } from '@/lib/boleto-estado'
import { toSale } from '@/lib/sale-dto'

export const dynamic = 'force-dynamic'

type SaleRequest = {
  ticketIds?: string[]
  /** Código de barras escaneado. Actualiza los dígitos de control de la fracción que se ha leído. */
  scan?: string
}

function parseTicketId(value: string) {
  const [numeroJugado, serie, fraccion] = value.split('/')
  if (!numeroJugado || !serie || !fraccion) return null
  return { numeroJugado, serie, fraccion }
}

function parseScan(value: string | undefined) {
  if (!value?.trim()) return null
  try {
    return parseSelaeBarcode(value)
  } catch {
    return null
  }
}

export async function GET() {
  const boletos = await prisma.boleto.findMany({
    where: CON_VENTA,
    include: { sorteo: true },
    orderBy: { fechaHoraVenta: 'desc' },
  })
  return Response.json(boletos.map(toSale))
}

export async function POST(request: Request) {
  const body = (await request.json()) as SaleRequest
  const ticketIds = body.ticketIds ?? []
  if (ticketIds.length === 0) return Response.json({ error: 'No se han recibido boletos' }, { status: 400 })
  const scan = parseScan(body.scan)

  try {
    const sales = await prisma.$transaction(async (tx) => {
      const created = []
      for (const ticketId of ticketIds) {
        const parsed = parseTicketId(ticketId)
        if (!parsed) throw new Error(`Identificador de boleto no válido: ${ticketId}`)

        // El código escaneado identifica la serie leída y, dentro de ella, la fracción exacta que se ha leído:
        // solo esa fracción trae sus dígitos de control.
        const deLaSerie: SelaeBarcode | null = scan && scan.numeroJugado === parsed.numeroJugado && scan.serie === parsed.serie ? scan : null
        const leido = deLaSerie && deLaSerie.fraccion === parsed.fraccion ? deLaSerie : null
        const sorteoEscaneado = deLaSerie ? await findSorteoForScan(tx, deLaSerie) : null
        if (deLaSerie && !sorteoEscaneado) throw new Error('El sorteo del código escaneado no existe. Créalo antes en el apartado Sorteos de la pestaña Registro')

        let boleto = await tx.boleto.findFirst({ where: sorteoEscaneado ? { ...parsed, idSorteo: sorteoEscaneado.idSorteo } : parsed })
        // Un décimo cuyo albarán aún no se ha cargado se puede vender igualmente; se recibirá después.
        // Las demás fracciones de la serie leída (venta de serie completa) no traen dígitos de control propios.
        if (!boleto && sorteoEscaneado && deLaSerie) {
          boleto = await crearBoletoSinRecibir(tx, {
            idSorteo: sorteoEscaneado.idSorteo,
            ...parsed,
            digitosControl: leido ? leido.digitosControl : SELAE_CONTROL_DESCONOCIDO,
            // Las demás fracciones de la serie no traen su código: se construye con los dígitos de control a 0000.
            codigoBarrasRaw: leido ? leido.codigo : buildSelaeBarcodeForSorteo(sorteoEscaneado.idSorteo, parsed),
          })
        }
        if (!boleto) throw new Error(`Boleto no encontrado: ${ticketId}`)

        // Al leer el código en la venta se actualizan los dígitos de control y el código de barras (sin separador).
        const venta = await venderBoleto(tx, boleto, new Date(), leido ? { digitosControl: leido.digitosControl, codigoBarrasRaw: leido.codigo } : undefined)
        created.push(toSale(venta))
      }
      return created
    })

    return Response.json(sales, { status: 201 })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'No se pudo registrar la venta' }, { status: 409 })
  }
}
