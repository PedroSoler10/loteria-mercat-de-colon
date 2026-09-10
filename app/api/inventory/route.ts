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
    prisma.cedido.findMany({ where: { origen: { deletedAt: null } }, include: { sorteo: true } }),
  ])
  const soldIds = new Set(ventas.map((venta) => venta.idBoleto))
  const cededKeys = new Set(cedidos.map((cedido) => `${cedido.idSorteo}/${cedido.numeroJugado}/${cedido.serie}/${cedido.fraccion}`))
  const receivedKeys = new Set(boletos.map((boleto) => `${boleto.idSorteo}/${boleto.numeroJugado}/${boleto.serie}/${boleto.fraccion}`))

  const received = boletos.map((boleto) => ({
    numero: boleto.numeroJugado,
    serie: boleto.serie,
    fraccion: boleto.fraccion,
    albaranId: boleto.idOrigen,
    tipoJuego: String(boleto.sorteo.tipoJuego),
    sorteo: boleto.sorteo.nombreSorteo,
    anio: boleto.sorteo.anoCompleto,
    registrado: boleto.fechaHoraRegistro.toISOString(),
    vendido: soldIds.has(boleto.idBoleto),
    cedido: cededKeys.has(`${boleto.idSorteo}/${boleto.numeroJugado}/${boleto.serie}/${boleto.fraccion}`),
    recibido: true,
  }))
  const cededOnly = cedidos
    .filter((cedido) => !receivedKeys.has(`${cedido.idSorteo}/${cedido.numeroJugado}/${cedido.serie}/${cedido.fraccion}`))
    .map((cedido) => ({
      numero: cedido.numeroJugado,
      serie: cedido.serie,
      fraccion: cedido.fraccion,
      albaranId: cedido.idOrigen,
      tipoJuego: String(cedido.sorteo.tipoJuego),
      sorteo: cedido.sorteo.nombreSorteo,
      anio: cedido.sorteo.anoCompleto,
      registrado: cedido.fechaHoraCesion.toISOString(),
      vendido: false,
      cedido: true,
      recibido: false,
    }))
  return Response.json([...received, ...cededOnly])
}
