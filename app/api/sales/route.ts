import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
const DEFAULT_TICKET_PRICE_CENTIMOS = 2000

type SaleRequest = {
  ticketIds?: string[]
}

function parseTicketId(value: string) {
  const [numeroJugado, serie, fraccion] = value.split('/')
  if (!numeroJugado || !serie || !fraccion) return null
  return { numeroJugado, serie, fraccion }
}

function toSale(venta: { idBoleto: string; fechaHoraVenta: Date; estado: string; boleto: { numeroJugado: string; serie: string; fraccion: string; origen: { tipoOrigen: string }; sorteo: { tipoJuego: number; nombreSorteo: string; anoCompleto: number; precioCentimos: number } } }) {
  return {
    id: venta.idBoleto,
    fecha: venta.fechaHoraVenta.toISOString(),
    tipoJuego: String(venta.boleto.sorteo.tipoJuego),
    sorteo: venta.boleto.sorteo.nombreSorteo,
    anio: venta.boleto.sorteo.anoCompleto,
    numero: venta.boleto.numeroJugado,
    serie: venta.boleto.serie,
    fraccion: venta.boleto.fraccion,
    precio: (venta.boleto.sorteo.precioCentimos || DEFAULT_TICKET_PRICE_CENTIMOS) / 100,
    estado: venta.estado,
    importada: venta.boleto.origen.tipoOrigen === 'Venta importada',
  }
}

export async function GET() {
  const ventas = await prisma.venta.findMany({
    include: { boleto: { include: { sorteo: true, origen: true } } },
    orderBy: { fechaHoraVenta: 'desc' },
  })
  return Response.json(ventas.map(toSale))
}

export async function POST(request: Request) {
  const body = (await request.json()) as SaleRequest
  const ticketIds = body.ticketIds ?? []
  if (ticketIds.length === 0) return Response.json({ error: 'No se han recibido boletos' }, { status: 400 })

  try {
    const sales = await prisma.$transaction(async (tx) => {
      const created = []
      for (const ticketId of ticketIds) {
        const parsed = parseTicketId(ticketId)
        if (!parsed) throw new Error(`Identificador de boleto no válido: ${ticketId}`)

        const boleto = await tx.boleto.findFirst({
          where: parsed,
          include: { sorteo: true },
        })
        if (!boleto) throw new Error(`Boleto no encontrado: ${ticketId}`)

        const existing = await tx.venta.findUnique({ where: { idBoleto: boleto.idBoleto } })
        if (existing?.estado === 'activa') throw new Error(`El boleto ya está vendido: ${ticketId}`)

        const venta = existing
          ? await tx.venta.update({
              where: { idBoleto: boleto.idBoleto },
              data: { estado: 'activa', fechaHoraVenta: new Date(), fechaHoraAnulacion: null, motivoAnulacion: null },
              include: { boleto: { include: { sorteo: true, origen: true } } },
            })
          : await tx.venta.create({
              data: { idBoleto: boleto.idBoleto },
              include: { boleto: { include: { sorteo: true, origen: true } } },
            })
        created.push(toSale(venta))
      }
      return created
    })

    return Response.json(sales, { status: 201 })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'No se pudo registrar la venta' }, { status: 409 })
  }
}
