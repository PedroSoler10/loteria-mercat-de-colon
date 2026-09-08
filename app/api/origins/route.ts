import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const origins = await prisma.origen.findMany({
    where: { deletedAt: null },
    include: {
      _count: { select: { boletos: true } },
      boletos: { select: { numeroJugado: true, serie: true, fraccion: true } },
    },
    orderBy: { fechaHoraCarga: 'desc' },
  })

  const result = await Promise.all(origins.map(async (origin) => {
    const numerosDiferentes = await prisma.boleto.groupBy({
      by: ['numeroJugado'],
      where: { idOrigen: origin.idOrigen },
    })
    const byNumber = new Map<string, Map<string, string[]>>()
    for (const boleto of origin.boletos) {
      if (!byNumber.has(boleto.numeroJugado)) byNumber.set(boleto.numeroJugado, new Map())
      const bySeries = byNumber.get(boleto.numeroJugado)!
      if (!bySeries.has(boleto.serie)) bySeries.set(boleto.serie, [])
      bySeries.get(boleto.serie)!.push(boleto.fraccion)
    }
    const detalles = Array.from(byNumber.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([numero, bySeries]) => ({
      numero,
      series: Array.from(bySeries.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([serie, fracciones]) => ({
        serie,
        fracciones: fracciones.sort((a, b) => Number(a) - Number(b)),
      })),
    }))

    return {
      idOrigen: origin.idOrigen,
      nombre: origin.nombreAlbaran,
      numerosDiferentes: numerosDiferentes.length,
      totalBoletos: origin._count.boletos,
      detalles,
    }
  }))

  return Response.json(result)
}
