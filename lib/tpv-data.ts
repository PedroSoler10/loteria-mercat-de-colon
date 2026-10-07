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
  /** Venta de un boleto cuyo albarán de entrada aún no está cargado. */
  sinAlbaran?: boolean
}

export type Periodo = 'hoy' | 'semana' | 'mes'

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

/** "2026-09-30" en hora local, el formato de <input type="date">. */
export function toDateInput(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Ventas de un único día natural (hora local); `day` en formato "2026-09-30". */
export function filterByDay(list: Sale[], day: string) {
  const [year, month, date] = day.split('-').map(Number)
  const from = new Date(year, month - 1, date)
  if (Number.isNaN(from.getTime())) return []
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  return list.filter((s) => {
    const time = new Date(s.fecha).getTime()
    return time >= from.getTime() && time < to.getTime()
  })
}

/** "Miércoles, 30 de septiembre de 2026" */
export function formatDia(day: string) {
  const [year, month, date] = day.split('-').map(Number)
  const text = new Date(year, month - 1, date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** Rango legible de números: [1,2,3,5] -> "1-3, 5". Con `width` se rellenan con ceros (series: "133-147"). */
function formatRangos(values: number[], width = 0) {
  const sorted = [...new Set(values)].sort((a, b) => a - b)
  const text = (n: number) => String(n).padStart(width, '0')
  const parts: string[] = []
  for (let i = 0; i < sorted.length; ) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j += 1
    parts.push(j > i ? `${text(sorted[i])}-${text(sorted[j])}` : text(sorted[i]))
    i = j + 1
  }
  return parts.join(', ')
}

export const SERIE_DIGITOS = 3

export function formatFracciones(fracciones: number[]) {
  return formatRangos(fracciones)
}

export function formatSeries(series: number[]) {
  return formatRangos(series, SERIE_DIGITOS)
}

/** Interpreta "1-10", "3" o "1-3, 5" como lista de números; devuelve null si no es válido. */
function parseRangos(text: string, maxDigits: number, min: number) {
  const result = new Set<number>()
  const pattern = new RegExp(`^(\\d{1,${maxDigits}})(?:-(\\d{1,${maxDigits}}))?$`)
  for (const part of text.split(/[,;\s]+/).filter(Boolean)) {
    const match = pattern.exec(part)
    if (!match) return null
    const from = Number(match[1])
    const to = match[2] === undefined ? from : Number(match[2])
    if (from < min || to < from) return null
    for (let n = from; n <= to; n += 1) result.add(n)
  }
  return result.size > 0 ? [...result].sort((a, b) => a - b) : null
}

export function parseFracciones(text: string) {
  return parseRangos(text, 2, 1)
}

export function parseSeries(text: string) {
  return parseRangos(text, SERIE_DIGITOS, 0)
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
