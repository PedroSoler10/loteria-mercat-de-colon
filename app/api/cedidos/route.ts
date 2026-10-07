import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cedidos = await prisma.boleto.findMany({
    where: { estado: 'cedido', origenCesion: { deletedAt: null } },
    include: { sorteo: true },
    orderBy: { fechaHoraCesion: 'desc' },
  })
  return Response.json(cedidos.map((boleto) => ({
    id: `${boleto.idOrigenCesion}-${boleto.idBoleto}`,
    // Nulo mientras el boleto no se haya recibido (su albarán de entrada no está cargado).
    idBoleto: boleto.idOrigen ? boleto.idBoleto : null,
    idOrigen: boleto.idOrigenCesion,
    fecha: (boleto.fechaHoraCesion ?? boleto.fechaHoraRegistro).toISOString(),
    tipoJuego: String(boleto.sorteo.tipoJuego),
    sorteo: boleto.sorteo.nombreSorteo,
    anio: boleto.sorteo.anoCompleto,
    numero: boleto.numeroJugado,
    serie: boleto.serie,
    fraccion: boleto.fraccion,
    precio: 0,
    estado: 'activa',
  })))
}
