import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Prisma } from '@prisma/client'
import { getConfigDirectory } from '@/lib/database-location'
import { prisma } from '@/lib/prisma'

export const DEFAULT_TICKET_PRICE_CENTIMOS = 2000
const DEFAULT_JUEGOS: Record<string, string> = { '5': 'Lotería Nacional' }

export type SorteoConfig = {
  tipoJuego: number
  anoCompleto: number
  numeroSorteo: number
  nombre: string
  precioCentimos: number
}

export type SorteosConfigFile = {
  juegos: Record<string, string>
  sorteos: SorteoConfig[]
}

export type SorteoKey = Pick<SorteoConfig, 'tipoJuego' | 'anoCompleto' | 'numeroSorteo'>
type Tx = Prisma.TransactionClient

export class SorteoError extends Error {
  constructor(message: string, readonly status = 400, readonly extra: Record<string, unknown> = {}) {
    super(message)
  }
}

export function idSorteo({ tipoJuego, anoCompleto, numeroSorteo }: SorteoKey) {
  return `${tipoJuego}${anoCompleto}${String(numeroSorteo).padStart(3, '0')}`
}

export function genericSorteoName({ anoCompleto, numeroSorteo }: SorteoKey) {
  return `Sorteo ${String(numeroSorteo).padStart(3, '0')} de ${anoCompleto}`
}

export function nombreJuego(config: SorteosConfigFile, tipoJuego: number) {
  return config.juegos[String(tipoJuego)] ?? `Juego ${tipoJuego}`
}

function configPath() {
  return path.join(getConfigDirectory(), 'sorteos.json')
}

function integerInRange(value: unknown, min: number, max: number, label: string) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isInteger(number) || number < min || number > max) {
    throw new SorteoError(`${label} debe ser un número entero entre ${min} y ${max}`)
  }
  return number
}

export function validateNombre(value: unknown) {
  const nombre = typeof value === 'string' ? value.trim() : ''
  if (!nombre) throw new SorteoError('El nombre del sorteo no puede estar vacío')
  if (nombre.length > 150) throw new SorteoError('El nombre del sorteo no puede superar los 150 caracteres')
  return nombre
}

export function validatePrecio(value: unknown) {
  return integerInRange(value, 1, 100_000, 'El precio (en céntimos)')
}

export function validateSorteo(input: Partial<Record<keyof SorteoConfig, unknown>>, juegos: Record<string, string>): SorteoConfig {
  const tipoJuego = integerInRange(input.tipoJuego, 1, 9, 'El número de juego')
  if (!(String(tipoJuego) in juegos)) throw new SorteoError(`El juego ${tipoJuego} no está definido en el catálogo de juegos`)
  return {
    tipoJuego,
    anoCompleto: integerInRange(input.anoCompleto, 2000, 2099, 'El año'),
    numeroSorteo: integerInRange(input.numeroSorteo, 1, 999, 'El número de sorteo'),
    nombre: validateNombre(input.nombre),
    precioCentimos: validatePrecio(input.precioCentimos),
  }
}

function sortSorteos(sorteos: SorteoConfig[]) {
  return [...sorteos].sort((a, b) => a.anoCompleto - b.anoCompleto || a.tipoJuego - b.tipoJuego || a.numeroSorteo - b.numeroSorteo)
}

export async function writeConfig(config: SorteosConfigFile) {
  const target = configPath()
  await mkdir(path.dirname(target), { recursive: true })
  const temporary = `${target}.tmp`
  await writeFile(temporary, `${JSON.stringify({ juegos: config.juegos, sorteos: sortSorteos(config.sorteos) }, null, 2)}\n`, 'utf8')
  await rename(temporary, target)
}

function parseConfig(raw: string): SorteosConfigFile {
  let data: { juegos?: unknown; sorteos?: unknown }
  try {
    data = JSON.parse(raw.replace(/^﻿/, ''))
  } catch {
    throw new SorteoError('El archivo sorteos.json no es un JSON válido', 500)
  }
  const fileJuegos = data.juegos && typeof data.juegos === 'object' && !Array.isArray(data.juegos) ? data.juegos as Record<string, unknown> : {}
  const juegos: Record<string, string> = { ...DEFAULT_JUEGOS }
  for (const [key, value] of Object.entries(fileJuegos)) if (typeof value === 'string' && value.trim()) juegos[key] = value.trim()
  if (!Array.isArray(data.sorteos)) throw new SorteoError('El archivo sorteos.json debe contener una lista «sorteos»', 500)
  const sorteos = data.sorteos.map((item, index) => {
    try {
      return validateSorteo(item as Partial<Record<keyof SorteoConfig, unknown>>, juegos)
    } catch (error) {
      throw new SorteoError(`sorteos.json: el sorteo ${index + 1} no es válido. ${error instanceof Error ? error.message : ''}`, 500)
    }
  })
  return { juegos, sorteos }
}

function rowToConfig(row: { tipoJuego: number; anoCompleto: number; numeroSorteo: number; nombreSorteo: string; precioCentimos: number }): SorteoConfig {
  return { tipoJuego: row.tipoJuego, anoCompleto: row.anoCompleto, numeroSorteo: row.numeroSorteo, nombre: row.nombreSorteo, precioCentimos: row.precioCentimos }
}

/**
 * Lee la configuración de sorteos. Si el archivo no existe se crea a partir de los
 * sorteos que ya hay en la base de datos, y los sorteos de la base que falten en el
 * archivo se añaden, para que ambos no puedan quedar desalineados.
 */
export async function loadConfig(db: Tx | typeof prisma = prisma): Promise<SorteosConfigFile> {
  let config: SorteosConfigFile
  let changed = false
  try {
    config = parseConfig(await readFile(configPath(), 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    config = { juegos: { ...DEFAULT_JUEGOS }, sorteos: [] }
    changed = true
  }
  const rows = await db.sorteo.findMany()
  for (const row of rows) {
    if (!config.sorteos.some((sorteo) => idSorteo(sorteo) === row.idSorteo)) {
      config.sorteos.push(rowToConfig(row))
      changed = true
    }
  }
  if (changed) await writeConfig(config)
  return config
}

export async function listSorteos() {
  const config = await loadConfig()
  const rows = await prisma.sorteo.findMany({ include: { _count: { select: { boletos: true } } } })
  const sorteos = await Promise.all(sortSorteos(config.sorteos).map(async (sorteo) => {
    const id = idSorteo(sorteo)
    const row = rows.find((candidate) => candidate.idSorteo === id)
    return {
      idSorteo: id,
      ...sorteo,
      nombreJuego: nombreJuego(config, sorteo.tipoJuego),
      boletos: row?._count.boletos ?? 0,
      ventas: await prisma.venta.count({ where: { boleto: { is: { idSorteo: id } } } }),
    }
  }))
  return { juegos: config.juegos, sorteos }
}

async function createRow(tx: Tx, sorteo: SorteoConfig) {
  return tx.sorteo.create({
    data: {
      idSorteo: idSorteo(sorteo),
      tipoJuego: sorteo.tipoJuego,
      anoEmision: sorteo.anoCompleto % 10,
      anoCompleto: sorteo.anoCompleto,
      numeroSorteo: sorteo.numeroSorteo,
      nombreSorteo: sorteo.nombre,
      precioCentimos: sorteo.precioCentimos,
    },
  })
}

/**
 * Devuelve la fila de `sorteos` para una clave (juego, año, número), creándola desde
 * el archivo de configuración si hace falta. Con `createIfUnknown` (importación de
 * albaranes) un sorteo desconocido se da de alta con los datos leídos y se anota en
 * el archivo; sin ella devuelve `null`.
 */
export async function ensureSorteo(tx: Tx, key: SorteoKey, options: { createIfUnknown: boolean }) {
  const config = await loadConfig(tx)
  const id = idSorteo(key)
  let entry = config.sorteos.find((sorteo) => idSorteo(sorteo) === id)
  let row = await tx.sorteo.findUnique({ where: { idSorteo: id } })

  if (!entry) {
    if (!options.createIfUnknown) return null
    entry = validateSorteo({ ...key, nombre: genericSorteoName(key), precioCentimos: DEFAULT_TICKET_PRICE_CENTIMOS }, config.juegos)
    config.sorteos.push(entry)
    await writeConfig(config)
  }
  if (!row) return createRow(tx, entry)

  // El archivo manda sobre el nombre. El precio solo se sincroniza mientras el sorteo
  // no tenga ventas, para no alterar retroactivamente los ingresos.
  const data: { nombreSorteo?: string; precioCentimos?: number } = {}
  if (row.nombreSorteo !== entry.nombre) data.nombreSorteo = entry.nombre
  if (row.precioCentimos !== entry.precioCentimos && await tx.venta.count({ where: { boleto: { is: { idSorteo: id } } } }) === 0) {
    data.precioCentimos = entry.precioCentimos
  }
  if (Object.keys(data).length > 0) row = await tx.sorteo.update({ where: { idSorteo: id }, data })
  return row
}

export async function createSorteo(input: Partial<Record<keyof SorteoConfig, unknown>>) {
  const config = await loadConfig()
  const sorteo = validateSorteo(input, config.juegos)
  const id = idSorteo(sorteo)
  if (config.sorteos.some((existing) => idSorteo(existing) === id)) throw new SorteoError('Ya existe un sorteo con ese juego, año y número', 409)
  config.sorteos.push(sorteo)
  await prisma.$transaction((tx) => createRow(tx, sorteo))
  await writeConfig(config)
  return id
}

export async function updateSorteo(id: string, input: { nombre?: unknown; precioCentimos?: unknown; confirmarPrecio?: boolean }) {
  const config = await loadConfig()
  const entry = config.sorteos.find((sorteo) => idSorteo(sorteo) === id)
  if (!entry) throw new SorteoError('El sorteo no existe', 404)
  const nombre = validateNombre(input.nombre)
  const precioCentimos = validatePrecio(input.precioCentimos)

  const ventas = await prisma.venta.count({ where: { boleto: { is: { idSorteo: id } } } })
  if (precioCentimos !== entry.precioCentimos && ventas > 0 && !input.confirmarPrecio) {
    throw new SorteoError(`El sorteo tiene ${ventas} venta${ventas === 1 ? '' : 's'} y cambiar el precio modificará sus ingresos`, 409, { requiereConfirmacion: true, ventas })
  }
  entry.nombre = nombre
  entry.precioCentimos = precioCentimos
  await prisma.sorteo.updateMany({ where: { idSorteo: id }, data: { nombreSorteo: nombre, precioCentimos } })
  await writeConfig(config)
}
