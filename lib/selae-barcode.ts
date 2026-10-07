/**
 * Código de barras de un décimo de Lotería Nacional. Estructura completa en `docs/codigo-barras-seleae.md`.
 *
 * Impreso son 21 caracteres con un separador `>` en la posición 11, pero el escáner lee (y la base de datos
 * guarda) solo 20, sin el separador:
 *
 *   pos 1      tipo de juego         pos 6-7    fracción
 *   pos 2-4    número de sorteo      pos 8-10   serie
 *   pos 5      último dígito del año pos 11     separador `>` (solo impreso)
 *   pos 12     relleno (0)           pos 13-17  número jugado
 *   pos 18-21  dígitos de control
 */
export type SelaeBarcode = {
  /** Texto tal y como se ha introducido. */
  raw: string
  /** Código normalizado: 20 caracteres, sin espacios y sin el separador de la posición 11. */
  codigo: string
  tipoJuego: number
  numeroSorteo: number
  anoEmision: number
  fraccion: string
  serie: string
  numeroJugado: string
  digitosControl: string
}

/** Posición 12 del código impreso: dígito de relleno estándar. */
export const SELAE_RELLENO = '0'
/** Dígitos de control de un boleto cuyo código aún no se ha leído con el escáner. */
export const SELAE_CONTROL_DESCONOCIDO = '0000'

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
    codigo: `${barcode.slice(0, 10)}${barcode.slice(11)}`,
    tipoJuego: Number(barcode.slice(0, 1)),
    numeroSorteo: Number(barcode.slice(1, 4)),
    anoEmision: Number(barcode.slice(4, 5)),
    fraccion: barcode.slice(5, 7),
    serie: barcode.slice(7, 10),
    numeroJugado: barcode.slice(12, 17),
    digitosControl: barcode.slice(17, 21),
  }
}

type DatosCodigo = {
  tipoJuego: number | string
  numeroSorteo: number | string
  /** Año completo (2026) o solo su última cifra; en el código solo entra la última. */
  anoCompleto: number | string
  fraccion: string
  serie: string
  numeroJugado: string
  digitosControl?: string
}

/**
 * Construye el código de 20 caracteres (sin separador) de un boleto. Mientras no se haya leído con el
 * escáner no se conocen sus dígitos de control, que van a `0000`.
 */
export function buildSelaeBarcode(datos: DatosCodigo): string {
  return [
    String(datos.tipoJuego).slice(0, 1),
    String(datos.numeroSorteo).padStart(3, '0'),
    String(datos.anoCompleto).slice(-1),
    datos.fraccion.padStart(2, '0'),
    datos.serie.padStart(3, '0'),
    SELAE_RELLENO,
    datos.numeroJugado.padStart(5, '0'),
    (datos.digitosControl ?? SELAE_CONTROL_DESCONOCIDO).padStart(4, '0'),
  ].join('')
}

/**
 * Igual que `buildSelaeBarcode`, tomando el juego, el año y el número de sorteo del `idSorteo`
 * (tipo de juego de 1 cifra + año de 4 cifras + número de sorteo de 3 cifras, p. ej. `52026102`).
 */
export function buildSelaeBarcodeForSorteo(
  idSorteo: string,
  boleto: Pick<DatosCodigo, 'fraccion' | 'serie' | 'numeroJugado' | 'digitosControl'>,
): string {
  return buildSelaeBarcode({
    tipoJuego: idSorteo.slice(0, 1),
    anoCompleto: idSorteo.slice(1, 5),
    numeroSorteo: idSorteo.slice(5),
    ...boleto,
  })
}
