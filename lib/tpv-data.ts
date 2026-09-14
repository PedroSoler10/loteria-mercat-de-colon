import { ticketId, tickets, type Ticket } from './record-data'

export const PRECIO_DECIMO = 20

export type Sale = {
  id: string
  fecha: string // ISO
  tipoJuego: string
  sorteo: string
  anio: number
  numero: string
  serie: string
  fraccion: string
  precio: number
  estado: 'activa' | 'anulada'
  importada?: boolean
}

export type Periodo = 'hoy' | 'semana' | 'mes'

let seq = 0
export function newSaleId() {
  seq += 1
  return `V-${Date.now().toString(36).toUpperCase()}-${seq}`
}

export function saleFromTicket(t: Ticket, fecha = new Date(), precio = PRECIO_DECIMO): Sale {
  return {
    id: newSaleId(),
    fecha: fecha.toISOString(),
    tipoJuego: t.tipoJuego,
    sorteo: t.sorteo,
    anio: t.anio,
    numero: t.numero,
    serie: t.serie,
    fraccion: t.fraccion,
    precio,
    estado: 'activa',
  }
}

export function saleTicketId(s: Sale) {
  return ticketId(s)
}

/** Fecha relativa a ahora: hace N días, a una hora concreta. */
function at(daysAgo: number, hour: number, minute: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d
}

/** Genera el historial que justifica los boletos marcados como vendidos en el inventario. */
function seedSalesLog(): Sale[] {
  const sold = tickets.filter((t) => t.vendido)
  const byKey = new Map(sold.map((t) => [ticketId(t), t]))
  const pick = (numero: string, serie: string, fracciones: number[]) =>
    fracciones.map((f) => byKey.get(`${numero}/${serie}/${f}`)).filter((t): t is Ticket => Boolean(t))

  const batches: { tickets: Ticket[]; fecha: Date }[] = [
    // Hoy
    { tickets: pick('04521', '002', [1, 2]), fecha: at(0, 9, 12) },
    { tickets: pick('04521', '002', [3, 4]), fecha: at(0, 10, 47) },
    { tickets: pick('29906', '020', [1, 2]), fecha: at(0, 12, 3) },
    // Esta semana
    { tickets: pick('17384', '010', [1, 2, 3]), fecha: at(1, 11, 30) },
    { tickets: pick('17384', '010', [4, 5, 6, 7]), fecha: at(2, 17, 18) },
    { tickets: pick('04521', '001', [1, 2, 3, 4, 5]), fecha: at(3, 10, 5) },
    // Este mes / anteriores
    { tickets: pick('04521', '001', [6, 7, 8, 9, 10]), fecha: at(9, 13, 22) },
    { tickets: pick('88890', '060', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), fecha: at(14, 18, 40) },
    { tickets: pick('88890', '061', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), fecha: at(21, 12, 55) },
  ]

  const out: Sale[] = []
  for (const b of batches) {
    b.tickets.forEach((t, i) => {
      const f = new Date(b.fecha)
      f.setSeconds(i * 7)
      out.push(saleFromTicket(t, f))
    })
  }
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export const initialSales: Sale[] = seedSalesLog()

export function startOfPeriod(p: Periodo, now = new Date()) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  if (p === 'semana') {
    // Lunes como inicio de semana
    const day = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - day)
  } else if (p === 'mes') {
    d.setDate(1)
  }
  return d
}

export function filterByPeriodo(list: Sale[], p: Periodo, now = new Date()) {
  const from = startOfPeriod(p, now).getTime()
  return list.filter((s) => new Date(s.fecha).getTime() >= from)
}

export function sumSales(list: Sale[]) {
  return list.reduce((acc, s) => acc + s.precio, 0)
}

export const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

export function formatFechaHora(iso: string) {
  const d = new Date(iso)
  return {
    fecha: d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
  }
}
