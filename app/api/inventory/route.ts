import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [boletos, ventas, cedidos] = await Promise.all([
    prisma.boleto.findMany({
      where: { origen: { deletedAt: null } },
      include: { sorteo: true },
      orderBy: [{ numeroJugado: 'asc' }, { serie: 'asc' }, { fraccion: 'asc' }],
    }),
    prisma.venta.findMany({ where: { estado: 'activa' }, select: { idBoleto: true } }),
    prisma.cedido.findMany({ select: { idBoleto: true } }),
  ])
  const soldIds = new Set(ventas.map((venta) => venta.idBoleto))
  const cededIds = new Set(cedidos.map((cedido) => cedido.idBoleto))

  return Response.json(boletos.map((boleto) => ({
    numero: boleto.numeroJugado,
    serie: boleto.serie,
    fraccion: boleto.fraccion,
    albaranId: boleto.idOrigen,
    tipoJuego: String(boleto.sorteo.tipoJuego),
    sorteo: boleto.sorteo.nombreSorteo,
    anio: boleto.sorteo.anoCompleto,
    registrado: boleto.fechaHoraRegistro.toISOString(),
    vendido: soldIds.has(boleto.idBoleto),
    cedido: cededIds.has(boleto.idBoleto),
  })))
}
