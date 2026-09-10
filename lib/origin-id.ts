export type TemporaryOriginPrefix = 'MAN' | 'SCAN' | 'VENT'

export function temporaryOriginId(prefix: TemporaryOriginPrefix, date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${prefix}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

export function isTemporaryOriginId(idOrigen: string) {
  return /^(MAN|SCAN|VENT)[-_]\d{4}[-_]\d{2}[-_]\d{2}[-_]\d{2}[-_]\d{2}[-_]\d{2}$/.test(idOrigen)
}
