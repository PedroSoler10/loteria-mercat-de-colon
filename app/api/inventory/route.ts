import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const boletos = await prisma.boleto.findMany({
    where: {
      OR: [
        // Recibidos: su albarán de entrada sigue cargado.
        { origen: { deletedAt: null } },
        // No recibidos: solo cuentan si se han vendido o cedido antes de cargar el albarán.
        { idOrigen: null, estado: { in: ['vendido', 'cedido'] } },
        // Cedidos cuyo albarán de entrada se ha eliminado.
        { estado: 'cedido', origenCesion: { deletedAt: null } },
      ],
    },
    include: { sorteo: true, origen: { select: { deletedAt: true } } },
    orderBy: [{ numeroJugado: 'asc' }, { serie: 'asc' }, { fraccion: 'asc' }],
  })

  return Response.json(boletos.map((boleto) => {
    const recibido = boleto.idOrigen !== null && !boleto.origen?.deletedAt
    return {
      numero: boleto.numeroJugado,
      serie: boleto.serie,
      fraccion: boleto.fraccion,
      albaranId: (recibido ? boleto.idOrigen : boleto.idOrigenCesion) ?? '',
      tipoJuego: String(boleto.sorteo.tipoJuego),
      sorteo: boleto.sorteo.nombreSorteo,
      anio: boleto.sorteo.anoCompleto,
      registrado: (recibido ? boleto.fechaHoraRegistro : boleto.fechaHoraCesion ?? boleto.fechaHoraRegistro).toISOString(),
      vendido: boleto.estado === 'vendido',
      cedido: boleto.estado === 'cedido',
      recibido,
    }
  }))
}
