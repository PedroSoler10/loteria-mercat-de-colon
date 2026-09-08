export type Albaran = {
  idOrigen: string
  nombre: string
  nombreSorteo: string
  tipoOrigen: string
  fechaCarga: string
  fechaEmision: string | null
  pdfPath: string | null
  pdfChecksum: string | null
  numerosDiferentes: number
  totalSeries: number
  totalBoletos: number
  detalles?: CargaDetalle[]
}

export type Cedido = {
  id: string
  idBoleto: string | null
  idOrigen: string
  nombreAlbaran: string
  fecha: string
  tipoJuego: string
  sorteo: string
  anio: number
  numero: string
  serie: string
  fraccion: string
  precio: number
  estado: 'activa'
}

export type CargaDetalle = {
  numero: string
  series: {
    serie: string
    fracciones: string[]
  }[]
}

export type Ticket = {
  numero: string
  serie: string
  fraccion: string
  albaranId: string
  tipoJuego: string
  sorteo: string
  anio: number
  registrado: string
  vendido: boolean
  cedido: boolean
  recibido: boolean
}

export function ticketId(t: Pick<Ticket, 'numero' | 'serie' | 'fraccion'>) {
  return `${t.numero}/${t.serie}/${t.fraccion}`
}

export type SerieNode = {
  serie: string
  fracciones: Ticket[]
}

export type NumeroNode = {
  numero: string
  series: SerieNode[]
  totalBoletos: number
}

export const albaranes: Albaran[] = [
  { idOrigen: 'ALB-2026-00412', nombre: 'Navidad · Lote 1', nombreSorteo: 'Sorteo Extraordinario de Navidad 2026', tipoOrigen: 'Albarán', fechaCarga: '2026-08-28T09:14:00.000Z', fechaEmision: '2026-08-28T00:00:00.000Z', pdfPath: null, pdfChecksum: null, numerosDiferentes: 4, totalSeries: 24, totalBoletos: 240 },
  { idOrigen: 'ALB-2026-00418', nombre: 'Navidad · Lote 2', nombreSorteo: 'Sorteo Extraordinario de Navidad 2026', tipoOrigen: 'Albarán', fechaCarga: '2026-08-30T11:42:00.000Z', fechaEmision: '2026-08-30T00:00:00.000Z', pdfPath: null, pdfChecksum: null, numerosDiferentes: 2, totalSeries: 12, totalBoletos: 120 },
  { idOrigen: 'ALB-2026-00425', nombre: 'Reposición abonados', nombreSorteo: 'Sorteo Extraordinario de Navidad 2026', tipoOrigen: 'Albarán', fechaCarga: '2026-09-01T17:05:00.000Z', fechaEmision: '2026-09-01T00:00:00.000Z', pdfPath: null, pdfChecksum: null, numerosDiferentes: 1, totalSeries: 2, totalBoletos: 20 },
]

const TIPO = 'Lotería Nacional'
const SORTEO = 'Navidad'
const ANIO = 2026

function buildTickets(
  numero: string,
  series: string[],
  albaranId: string,
  fecha: string,
  fracciones = 10,
): Ticket[] {
  const out: Ticket[] = []
  for (const serie of series) {
    for (let f = 1; f <= fracciones; f++) {
      out.push({
        numero,
        serie,
        fraccion: String(f),
        albaranId,
        tipoJuego: TIPO,
        sorteo: SORTEO,
        anio: ANIO,
        registrado: fecha,
        vendido: false,
        cedido: false,
        recibido: true,
      })
    }
  }
  return out
}

/** Marca como vendidas algunas fracciones de muestra para que las métricas tengan sentido. */
function seedSales(list: Ticket[]): Ticket[] {
  const sold = new Set<string>([
    // 04521 / 001: serie completa vendida
    ...Array.from({ length: 10 }, (_, i) => `04521/001/${i + 1}`),
    // 04521 / 002: 4 fracciones
    '04521/002/1',
    '04521/002/2',
    '04521/002/3',
    '04521/002/4',
    // 17384 / 010: 7 fracciones
    ...Array.from({ length: 7 }, (_, i) => `17384/010/${i + 1}`),
    // 29906 / 020: 2 fracciones
    '29906/020/1',
    '29906/020/2',
    // 88890 / 060 y 061: todo vendido
    ...Array.from({ length: 10 }, (_, i) => `88890/060/${i + 1}`),
    ...Array.from({ length: 10 }, (_, i) => `88890/061/${i + 1}`),
  ])
  return list.map((t) => (sold.has(ticketId(t)) ? { ...t, vendido: true } : t))
}

export const tickets: Ticket[] = seedSales([
  ...buildTickets('04521', ['001', '002', '003', '004', '005', '006'], 'ALB-2026-00412', '2026-08-28 09:14'),
  ...buildTickets('17384', ['010', '011', '012', '013', '014', '015'], 'ALB-2026-00412', '2026-08-28 09:14'),
  ...buildTickets('29906', ['020', '021', '022', '023', '024', '025'], 'ALB-2026-00412', '2026-08-28 09:15'),
  ...buildTickets('48212', ['030', '031', '032', '033', '034', '035'], 'ALB-2026-00412', '2026-08-28 09:15'),
  ...buildTickets('66057', ['040', '041', '042', '043', '044', '045'], 'ALB-2026-00418', '2026-08-30 11:42'),
  ...buildTickets('75318', ['050', '051', '052', '053', '054', '055'], 'ALB-2026-00418', '2026-08-30 11:43'),
  ...buildTickets('88890', ['060', '061'], 'ALB-2026-00425', '2026-09-01 17:05'),
])

export type StockCounts = { recibidos: number; cedidos: number; vendidos: number; disponibles: number }

export function countStock(list: Ticket[]): StockCounts {
  const cedidos = list.filter((t) => t.cedido).length
  const vendidos = list.filter((t) => t.vendido).length
  const recibidos = list.filter((t) => t.recibido).length
  return { recibidos, cedidos, vendidos, disponibles: Math.max(0, recibidos - cedidos - vendidos) }
}

export function groupTickets(list: Ticket[]): NumeroNode[] {
  const byNumero = new Map<string, Map<string, Ticket[]>>()
  for (const t of list) {
    if (!byNumero.has(t.numero)) byNumero.set(t.numero, new Map())
    const bySerie = byNumero.get(t.numero)!
    if (!bySerie.has(t.serie)) bySerie.set(t.serie, [])
    bySerie.get(t.serie)!.push(t)
  }
  return Array.from(byNumero.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([numero, bySerie]) => {
      const series = Array.from(bySerie.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([serie, fracciones]) => ({
          serie,
          fracciones: [...fracciones].sort((a, b) => Number(a.fraccion) - Number(b.fraccion)),
        }))
      return {
        numero,
        series,
        totalBoletos: series.reduce((acc, s) => acc + s.fracciones.length, 0),
      }
    })
}
