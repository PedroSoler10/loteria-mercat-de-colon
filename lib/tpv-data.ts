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

export type RangoVentas = 'hoy' | 'semana' | 'personalizado'

/** "2026-09-30" en hora local, el formato de <input type="date">. */
export function toDateInput(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Límites [desde, hasta) del rango elegido; null si el rango personalizado no es válido. */
export function rangeBounds(rango: RangoVentas, desde: string, hasta: string, now = new Date()) {
  if (rango === 'personalizado') {
    if (!desde || !hasta) return null
    const from = startOfDateInput(desde)
    const to = startOfDateInput(hasta)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null
    to.setDate(to.getDate() + 1)
    return { from, to }
  }
  const from = startOfPeriod(rango === 'semana' ? 'semana' : 'hoy', now)
  const to = new Date(from)
  to.setDate(to.getDate() + (rango === 'semana' ? 7 : 1))
  return { from, to }
}

export function filterByRange(list: Sale[], rango: RangoVentas, desde: string, hasta: string, now = new Date()) {
  const bounds = rangeBounds(rango, desde, hasta, now)
  if (!bounds) return []
  const from = bounds.from.getTime()
  const to = bounds.to.getTime()
  return list.filter((s) => {
    const time = new Date(s.fecha).getTime()
    return time >= from && time < to
  })
}

export function sumSales(list: Sale[]) {
  return list.reduce((acc, s) => acc + s.precio, 0)
}

export const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** Rango legible de fracciones: [1,2,3,5] -> "1-3, 5". */
export function formatFracciones(fracciones: number[]) {
  const sorted = [...new Set(fracciones)].sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < sorted.length; ) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j += 1
    parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : String(sorted[i]))
    i = j + 1
  }
  return parts.join(', ')
}

/** Interpreta "1-10", "3" o "1-3, 5" como lista de fracciones; devuelve null si no es válido. */
export function parseFracciones(text: string) {
  const result = new Set<number>()
  for (const part of text.split(/[,;\s]+/).filter(Boolean)) {
    const match = /^(\d{1,2})(?:-(\d{1,2}))?$/.exec(part)
    if (!match) return null
    const from = Number(match[1])
    const to = match[2] === undefined ? from : Number(match[2])
    if (from < 1 || to < from) return null
    for (let n = from; n <= to; n += 1) result.add(n)
  }
  return result.size > 0 ? [...result].sort((a, b) => a - b) : null
}

/** "30/09/2026 11:50" */
export function formatFecha(iso: string) {
  const { fecha, hora } = formatFechaHora(iso)
  return `${fecha} ${hora}`
}

export function formatFechaHora(iso: string) {
  const d = new Date(iso)
  return {
    fecha: d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
  }
}
