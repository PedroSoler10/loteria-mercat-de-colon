import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cedidos = await prisma.cedido.findMany({
    include: { boleto: { include: { sorteo: true } } },
    orderBy: { fechaHoraCesion: 'desc' },
  })
  return Response.json(cedidos.map((cedido) => ({
    id: cedido.idBoleto,
    fecha: cedido.fechaHoraCesion.toISOString(),
    tipoJuego: String(cedido.boleto.sorteo.tipoJuego),
    sorteo: cedido.boleto.sorteo.nombreSorteo,
    anio: cedido.boleto.sorteo.anoCompleto,
    numero: cedido.boleto.numeroJugado,
    serie: cedido.boleto.serie,
    fraccion: cedido.boleto.fraccion,
    precio: cedido.precioCentimos / 100,
    estado: 'activa',
  })))
}
