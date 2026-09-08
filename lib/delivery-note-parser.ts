export type PdfTextItem = {
  text: string
  x: number
  y: number
  page: number
}

export type ParsedDeliveryNote = {
  sourceId: string
  name: string
  tipoJuego: number
  drawNumber: number
  year: number
  entries: {
    number: string
    seriesFrom: number
    seriesTo: number
    fractions?: string[]
  }[]
}

function sourceIdFromFileName(fileName: string) {
  const stem = fileName.replace(/\.pdf$/i, '').trim()
  const safeStem = stem
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase()
  return `PDF-${safeStem}`.slice(0, 80)
}

function normalizeNumber(value: string) {
  return value.replace('.', '').padStart(5, '0')
}

function detectName(text: string) {
  const names = [
    'Series Completas',
    'Venta por Terminal',
    'Abonos Fijos',
    'Distribución Libre',
    'Pedidos sobre Reserva No Fabricada',
    'Recepción del Cambio Consignación',
  ]
  return names.find((name) => text.includes(name)) ?? 'Albarán SELAE'
}

function readHeader(text: string, fileName: string) {
  const normalized = text.replace(/\u00a0/g, ' ').replace(/\r/g, '')
  const sourceId = normalized.match(/Nº\s*albarán\s+(\d{6,})/i)?.[1]
    ?? normalized.match(/Sorteo\s+(\d{6,})/i)?.[1]
    ?? normalized.match(/\b(\d{9})\b/)?.[1]
    ?? sourceIdFromFileName(fileName)
  const separatedDraw = normalized.match(/(?:^|\s)(\d{4})\s+\d{1,2}\/\d{1,2}\/\d{2}\s+\d{1,3}\s+(\d{1,3})\s+de(?:\s|$)/i)
    ?? normalized.match(/(?:^|\s)(\d{4})\s+\d{1,2}\/\d{1,2}\/\d{2}\s+\d{1,3}\s+de\s+(\d{1,3})(?:\s|$)/i)
  const standardDraw = normalized.match(/Sorteo\s+(\d{1,3})\s+de\s+(\d{4})/i)
  const year = separatedDraw ? Number(separatedDraw[1]) : Number(standardDraw?.[2])
  const drawNumber = separatedDraw ? Number(separatedDraw[2]) : Number(standardDraw?.[1])

  if (!sourceId) throw new Error('No se ha encontrado el número de albarán en el PDF ni en el nombre del archivo')
  if (!Number.isInteger(year) || !Number.isInteger(drawNumber)) throw new Error('No se ha encontrado el sorteo y año en el PDF')
  return { normalized, sourceId, year, drawNumber }
}

function rowsFromItems(items: PdfTextItem[]) {
  const rows: { page: number; y: number; text: string }[] = []
  for (const item of items.filter((item) => item.text.trim()).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)) {
    const row = rows.find((candidate) => candidate.page === item.page && Math.abs(candidate.y - item.y) <= 2)
    if (row) row.text += ` ${item.text.trim()}`
    else rows.push({ page: item.page, y: item.y, text: item.text.trim() })
  }
  return rows.map((row) => row.text.replace(/\s+/g, ' ').trim())
}

function parseSeries(value: string) {
  const match = value.match(/Series?\s+(\d{3})(?:\s+a\s+(\d{3}))?/i)
  if (!match) return undefined
  return { from: Number(match[1]), to: Number(match[2] ?? match[1]) }
}

function parseFractionalRow(row: string) {
  const match = row.match(/(\d{2}\.\d{3})\s+(\d{3})\s+0[,\.]\d\s+([\d\s]+)/)
  if (!match) return undefined
  const fractions = match[3].trim().split(/\s+/).map((fraction) => fraction.padStart(2, '0'))
  return { number: normalizeNumber(match[1]), series: Number(match[2]), fractions }
}

export function parseDeliveryNoteItems(text: string, items: PdfTextItem[], fileName = ''): ParsedDeliveryNote {
  const { normalized, sourceId, year, drawNumber } = readHeader(text, fileName)
  const rows = rowsFromItems(items)
  const entries: ParsedDeliveryNote['entries'] = []
  let activeSeries: { from: number; to: number } | undefined

  for (const row of rows) {
    const fractional = parseFractionalRow(row)
    if (fractional) {
      entries.push({
        number: fractional.number,
        seriesFrom: fractional.series,
        seriesTo: fractional.series,
        fractions: fractional.fractions,
      })
      continue
    }

    const series = parseSeries(row)
    if (series) activeSeries = series
    const numbers = [...row.matchAll(/\b\d{2}\.\d{3}\b/g)].map((match) => normalizeNumber(match[0]))
    if (numbers.length === 0 || !activeSeries) continue

    for (const number of numbers) {
      entries.push({ number, seriesFrom: activeSeries.from, seriesTo: activeSeries.to })
    }
  }

  if (entries.length === 0) throw new Error('No se han podido extraer números y series del PDF')

  return { sourceId, name: detectName(normalized), tipoJuego: 5, drawNumber, year, entries }
}

export function parseDeliveryNoteText(text: string, fileName = ''): ParsedDeliveryNote {
  const { normalized, sourceId, year, drawNumber } = readHeader(text, fileName)
  const series = [...normalized.matchAll(/Series?\s+(\d{3})(?:\s+a\s+(\d{3}))?/gi)].map((match) => ({
    from: Number(match[1]),
    to: Number(match[2] ?? match[1]),
  }))
  const numbers = [...normalized.matchAll(/\b\d{2}\.\d{3}\b/g)].map((match) => normalizeNumber(match[0]))
  if (numbers.length === 0 || series.length === 0) throw new Error('No se han podido extraer números y series del PDF')
  if (numbers.length !== series.length) throw new Error('El PDF requiere lectura por coordenadas para asociar números y series')
  return {
    sourceId,
    name: detectName(normalized),
    tipoJuego: 5,
    drawNumber,
    year,
    entries: numbers.map((number, index) => ({ number, seriesFrom: series[index].from, seriesTo: series[index].to })),
  }
}
