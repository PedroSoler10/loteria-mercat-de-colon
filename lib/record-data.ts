export type Albaran = {
  idOrigen: string
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
