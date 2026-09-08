export type PdfTextItem = {
  text: string
  x: number
  y: number
  page: number
}

export type ParsedDeliveryNote = {
  sourceId: string
  receiverAdminId: string | null
  name: string
  originType: string
  tipoJuego: number
  drawNumber: number
  year: number
  drawName: string
  emissionDate: string | null
  totalNumbers: number
  totalSeries: number
  totalBilletes: number
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

const originTypes = [
  'Series Completas',
  'Venta por Terminal',
  'Abonos Fijos',
  'Distribución Libre',
  'Pedidos sobre Reserva No Fabricada',
  'Recepción del Cambio Consignación',
]

function detectOriginType(items: PdfTextItem[], fallback: string) {
  // Se exige separación entre letras para no confundir el rótulo «Nº albarán»
  // con el título tipográfico «A L B A R Á N».
  const title = items.find((item) => /A\s+L\s+B\s+A\s+R\s+(?:Á|A)\s+N/i.test(item.text))
  if (title) {
    const nearbyItems = items
      .filter((item) => item.page === title.page && item.y < title.y - 2 && item.y >= title.y - 35 && item.x < 400 && item.text.trim().length > 2)
      .sort((a, b) => b.y - a.y || a.x - b.x)
    const knownType = nearbyItems
      .map((item) => item.text.replace(/\s+/g, ' ').trim())
      .find((text) => originTypes.includes(text))
    if (knownType) return knownType
    const type = nearbyItems[0]
    if (type) return type.text.trim()
  }

  const normalized = fallback.replace(/\s+/g, ' ').trim()
  const match = normalized.match(/A\s*L\s*B\s*A\s*R\s*(?:Á|A)\s*N\s*\n?\s*([^\n]+)/i)
  return match?.[1]?.trim() || fallback
}

function readReceiverAdminId(text: string, items: PdfTextItem[]) {
  const pattern = /\b\d{5}-\d{9}\b/
  return items.map((item) => item.text.match(pattern)?.[0]).find((value): value is string => Boolean(value))
    ?? text.match(pattern)?.[0]
    ?? null
}

function readEmissionDate(items: PdfTextItem[]) {
  const label = items.find((item) => /Fecha\s+Salida\s+Billetes/i.test(item.text))
  if (!label) return null
  const date = items
    .filter((item) => item.page === label.page && item.y < label.y && label.y - item.y <= 35)
    .map((item) => item.text.match(/\b(\d{2})-(\d{2})-(\d{4})\b/)?.slice(1))
    .find((parts): parts is [string, string, string] => Boolean(parts))
  if (!date) return null
  const [day, month, year] = date
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString()
}

function drawName(tipoJuego: number, drawNumber: number, year: number) {
  if (tipoJuego === 5 && drawNumber === 102 && year === 2026) return 'Sorteo Extraordinario de Navidad 2026'
  return `Sorteo ${String(drawNumber).padStart(3, '0')} de ${year}`
}

function headerTextFromItems(items: PdfTextItem[], label: RegExp) {
  const labelItem = items.find((item) => label.test(item.text))
  if (!labelItem) return undefined
  return items
    .filter((item) => item.page === labelItem.page && Math.abs(item.y - labelItem.y) <= 2 && item.x >= labelItem.x)
    .sort((a, b) => a.x - b.x)
    .map((item) => item.text.trim())
    .join(' ')
}

function readHeader(text: string, fileName: string, items: PdfTextItem[] = []) {
  const normalized = text.replace(/\u00a0/g, ' ').replace(/\r/g, '')
  const sourceId = normalized.match(/N[º°o]\s*albar[aá]n\s*[:#-]?\s*(\d[A-Z0-9_-]{5,})/i)?.[1]
    ?? headerTextFromItems(items, /albar.n/i)?.match(/\d{6,}/)?.[0]
    ?? sourceIdFromFileName(fileName)
  const separatedDraw = normalized.match(/(?:^|\s)(\d{4})\s+\d{1,2}\/\d{1,2}\/\d{2}\s+\d{1,3}\s+(\d{1,3})\s+de(?:\s|$)/i)
  const standardDraw = normalized.match(/Sorteo\s+(\d{1,3})\s+de\s+(\d{4})/i)
  const coordinateDraw = headerTextFromItems(items, /^Sorteo$/i)?.match(/Sorteo\s+(\d{1,3})\s+de\s+(\d{4})/i)
  const fileDraw = fileName.match(/Sorteo\D*(\d{1,3})[_\s-]+(\d{4})/i)
  const year = separatedDraw
    ? Number(separatedDraw[1])
    : Number(standardDraw?.[2] ?? coordinateDraw?.[2] ?? fileDraw?.[2])
  const drawNumber = separatedDraw
    ? Number(separatedDraw[2])
    : Number(standardDraw?.[1] ?? coordinateDraw?.[1] ?? fileDraw?.[1])

  if (!sourceId) throw new Error('No se ha encontrado el número de albarán en el PDF ni en el nombre del archivo')
  if (!Number.isInteger(year) || !Number.isInteger(drawNumber)) throw new Error('No se ha encontrado el sorteo y año en el PDF')
  return { normalized, sourceId, year, drawNumber }
}

type PdfRow = {
  page: number
  y: number
  items: PdfTextItem[]
}

function rowsFromItems(items: PdfTextItem[]) {
  const rows: PdfRow[] = []
  for (const item of items.filter((item) => item.text.trim()).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)) {
    const row = rows.find((candidate) => candidate.page === item.page && Math.abs(candidate.y - item.y) <= 2)
    if (row) row.items.push(item)
    else rows.push({ page: item.page, y: item.y, items: [item] })
  }
  return rows.map((row) => ({
    ...row,
    items: row.items.sort((a, b) => a.x - b.x),
  }))
}

function rowText(row: PdfRow) {
  return row.items.map((item) => item.text.trim()).join(' ').replace(/\s+/g, ' ').trim()
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

function calculateTotals(entries: ParsedDeliveryNote['entries']) {
  const numbers = new Set<string>()
  const series = new Set<string>()
  const billetes = new Set<string>()
  for (const entry of entries) {
    numbers.add(entry.number)
    const fractions = entry.fractions?.length ? entry.fractions : Array.from({ length: 10 }, (_, index) => String(index + 1).padStart(2, '0'))
    for (let serie = entry.seriesFrom; serie <= entry.seriesTo; serie += 1) {
      const paddedSeries = String(serie).padStart(3, '0')
      series.add(`${entry.number}/${paddedSeries}`)
      for (const fraction of fractions) billetes.add(`${entry.number}/${paddedSeries}/${fraction}`)
    }
  }
  return { totalNumbers: numbers.size, totalSeries: series.size, totalBilletes: billetes.size }
}

export function parseDeliveryNoteItems(text: string, items: PdfTextItem[], fileName = ''): ParsedDeliveryNote {
  const { normalized, sourceId, year, drawNumber } = readHeader(text, fileName, items)
  const rows = rowsFromItems(items)
  const entries: ParsedDeliveryNote['entries'] = []
  let activeSeries: { from: number; to: number } | undefined

  for (const row of rows) {
    const text = rowText(row)
    const fractional = parseFractionalRow(text)
    if (fractional) {
      entries.push({
        number: fractional.number,
        seriesFrom: fractional.series,
        seriesTo: fractional.series,
        fractions: fractional.fractions,
      })
      continue
    }

    const series = parseSeries(text)
    if (series) activeSeries = series
    // El PDF coloca el rango de series y el número en la misma coordenada vertical.
    // Agrupar por fila evita relacionar un número con el rango anterior cuando hay
    // varios grupos consecutivos en un albarán.
    const numbers = [...text.matchAll(/\b\d{2}\.\d{3}\b/g)].map((match) => normalizeNumber(match[0]))
    if (numbers.length === 0 || !activeSeries) continue

    for (const number of numbers) {
      entries.push({ number, seriesFrom: activeSeries.from, seriesTo: activeSeries.to })
    }
  }

  if (entries.length === 0) throw new Error('No se han podido extraer números y series del PDF')

  const uniqueEntries = Array.from(
    new Map(entries.map((entry) => [
      `${entry.number}/${entry.seriesFrom}/${entry.seriesTo}/${entry.fractions?.join(',') ?? ''}`,
      entry,
    ])).values(),
  )

  const tipoJuego = 5
  return {
    sourceId,
    receiverAdminId: readReceiverAdminId(normalized, items),
    name: `Albarán ${sourceId}`,
    originType: detectOriginType(items, detectName(normalized)),
    tipoJuego,
    drawNumber,
    year,
    drawName: drawName(tipoJuego, drawNumber, year),
    emissionDate: readEmissionDate(items),
    ...calculateTotals(uniqueEntries),
    entries: uniqueEntries,
  }
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
  const entries = numbers.map((number, index) => ({ number, seriesFrom: series[index].from, seriesTo: series[index].to }))
  const tipoJuego = 5
  return {
    sourceId,
    receiverAdminId: readReceiverAdminId(normalized, []),
    name: `Albarán ${sourceId}`,
    originType: detectName(normalized),
    tipoJuego,
    drawNumber,
    year,
    drawName: drawName(tipoJuego, drawNumber, year),
    emissionDate: null,
    ...calculateTotals(entries),
    entries,
  }
}
