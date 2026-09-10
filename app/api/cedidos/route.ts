import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cedidos = await prisma.cedido.findMany({
    where: { origen: { deletedAt: null } },
    include: { sorteo: true, origen: { select: { idOrigen: true, nombreAlbaran: true } } },
    orderBy: { fechaHoraCesion: 'desc' },
  })
  return Response.json(cedidos.map((cedido) => ({
    id: cedido.idCedido,
    idBoleto: cedido.idBoleto,
    idOrigen: cedido.idOrigen,
    nombreAlbaran: cedido.origen.nombreAlbaran,
    fecha: cedido.fechaHoraCesion.toISOString(),
    tipoJuego: String(cedido.sorteo.tipoJuego),
    sorteo: cedido.sorteo.nombreSorteo,
    anio: cedido.sorteo.anoCompleto,
    numero: cedido.numeroJugado,
    serie: cedido.serie,
    fraccion: cedido.fraccion,
    precio: cedido.precioCentimos / 100,
    estado: 'activa',
  })))
}
