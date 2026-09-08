export type SelaeBarcode = {
  raw: string
  tipoJuego: number
  numeroSorteo: number
  anoEmision: number
  fraccion: string
  serie: string
  numeroJugado: string
  digitosControl: string
}

export function parseSelaeBarcode(value: string): SelaeBarcode {
  const raw = value.trim()
  const compact = raw.replace(/\s+/g, '')
  const barcode = /^\d{20}$/.test(compact)
    ? `${compact.slice(0, 10)}>${compact.slice(10)}`
    : compact
  if (!/^\d{10}[>\d]\d{10}$/.test(barcode)) {
    throw new Error('El código SELAE debe contener 20 dígitos; la posición 11 se completa internamente')
  }

  return {
    raw,
    tipoJuego: Number(barcode.slice(0, 1)),
    numeroSorteo: Number(barcode.slice(1, 4)),
    anoEmision: Number(barcode.slice(4, 5)),
    fraccion: barcode.slice(5, 7),
    serie: barcode.slice(7, 10),
    numeroJugado: barcode.slice(12, 17),
    digitosControl: barcode.slice(17, 21),
  }
}
