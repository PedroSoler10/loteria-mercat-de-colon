'use client'

import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { filterByRange, formatFechaHora, formatFracciones, formatSeries, rangeBounds, toDateInput, type RangoVentas, type Sale } from '@/lib/tpv-data'

type Props = {
  sales: Sale[]
  onEdit: (sales: Sale[]) => void
  onVoid: (sales: Sale[]) => void
  onRestore: (sales: Sale[]) => void
  onDelete: (sales: Sale[]) => void
}

/**
 * Una fila agrupa las ventas del mismo número, serie, estado y minuto.
 * Además, las series completas (fracciones 1 a 10) del mismo número, estado y minuto se juntan en una sola fila.
 */
type Row = { key: string; sales: Sale[] }

const FRACCIONES_SERIE_COMPLETA = 10

function isCompleteSeries(group: Sale[]) {
  const fractions = new Set(group.map((sale) => Number(sale.fraccion)))
  return group.length === FRACCIONES_SERIE_COMPLETA && Array.from({ length: FRACCIONES_SERIE_COMPLETA }, (_, index) => index + 1).every((n) => fractions.has(n))
}

function buildRows(sales: Sale[]): Row[] {
  const groups = new Map<string, Sale[]>()
  for (const sale of sales) {
    const minute = sale.fecha.slice(0, 16)
    const key = `${sale.numero}|${sale.serie}|${sale.estado}|${sale.sorteo}|${minute}`
    const group = groups.get(key)
    if (group) group.push(sale)
    else groups.set(key, [sale])
  }

  const rows: Row[] = []
  const completeByMinute = new Map<string, { key: string; sales: Sale[] }[]>()
  for (const [key, group] of groups) {
    const ordered = [...group].sort((a, b) => Number(a.fraccion) - Number(b.fraccion))
    if (isCompleteSeries(ordered)) {
      const first = ordered[0]
      const minuteKey = `${first.numero}|${first.estado}|${first.sorteo}|${first.fecha.slice(0, 16)}`
      const bucket = completeByMinute.get(minuteKey)
      if (bucket) bucket.push({ key, sales: ordered })
      else completeByMinute.set(minuteKey, [{ key, sales: ordered }])
    } else {
      rows.push({ key, sales: ordered })
    }
  }
  for (const [minuteKey, bucket] of completeByMinute) {
    const ordered = [...bucket].sort((a, b) => a.key.localeCompare(b.key))
    rows.push({ key: ordered.length > 1 ? `series|${minuteKey}` : ordered[0].key, sales: ordered.flatMap((item) => item.sales) })
  }
  return rows.sort((a, b) => latest(b).localeCompare(latest(a)) || a.key.localeCompare(b.key))
}

function latest(row: Row) {
  return row.sales.reduce((max, sale) => (sale.fecha > max ? sale.fecha : max), '')
}

const RANGOS: { value: RangoVentas; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'personalizado', label: 'Personalizado' },
]

export function TpvPeriodTable({ sales, onEdit, onVoid, onRestore, onDelete }: Props) {
  const [rango, setRango] = useState<RangoVentas>('hoy')
  const [desde, setDesde] = useState(() => toDateInput())
  const [hasta, setHasta] = useState(() => toDateInput())
  const periodSales = useMemo(() => filterByRange(sales, rango, desde, hasta), [sales, rango, desde, hasta])
  const rows = useMemo(() => buildRows(periodSales), [periodSales])
  const invalidRange = rango === 'personalizado' && rangeBounds(rango, desde, hasta) === null

  return (
    <section aria-labelledby="ventas-periodo-title" className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-3">
        <div className="flex flex-col">
          <h2 id="ventas-periodo-title" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Ventas
          </h2>
          <span className="text-sm text-foreground">
            {periodSales.length} {periodSales.length === 1 ? 'fracción vendida' : 'fracciones vendidas'} · más recientes primero
          </span>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div role="radiogroup" aria-label="Periodo de las ventas" className="flex w-fit rounded-md border bg-muted p-1">
            {RANGOS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant="ghost"
                role="radio"
                aria-checked={rango === option.value}
                onClick={() => setRango(option.value)}
                className={cn('h-9 px-4', rango === option.value && 'bg-card text-primary shadow-sm hover:bg-card')}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {rango === 'personalizado' && (
            <div className="flex flex-wrap items-end justify-end gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="ventas-desde" className="text-xs text-muted-foreground">Desde</Label>
                <Input id="ventas-desde" type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className="h-9 font-mono tabular-nums" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ventas-hasta" className="text-xs text-muted-foreground">Hasta</Label>
                <Input id="ventas-hasta" type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className="h-9 font-mono tabular-nums" />
              </div>
            </div>
          )}
        </div>
      </div>

      <Table className="min-w-[720px] table-auto text-base">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Fecha</TableHead>
            <TableHead>Hora</TableHead>
            <TableHead>Número</TableHead>
            <TableHead>Serie</TableHead>
            <TableHead className="text-right">Fracción</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                {invalidRange ? 'Elige una fecha inicial anterior o igual a la final.' : rango === 'hoy' ? 'No hay ventas registradas hoy.' : 'No hay ventas registradas en este periodo.'}
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => {
            const s = row.sales[0]
            const { fecha, hora } = formatFechaHora(s.fecha)
            const fracciones = formatFracciones(row.sales.map((sale) => Number(sale.fraccion)))
            const series = formatSeries(row.sales.map((sale) => Number(sale.serie)))
            const varias = row.sales.length > 1
            const etiqueta = `${s.numero} ${series.includes('-') || series.includes(',') ? 'series' : 'serie'} ${series} ${varias ? 'fracciones' : 'fracción'} ${fracciones}`
            const alcance = varias ? 'las ventas del grupo' : 'la venta'
            return (
              <TableRow key={row.key} className={s.estado === 'anulada' ? 'opacity-70' : undefined}>
                <TableCell className="font-mono tabular-nums">{fecha}</TableCell>
                <TableCell className="font-mono tabular-nums">{hora}</TableCell>
                <TableCell className="font-mono text-base font-semibold tabular-nums">
                  <div className="flex items-center gap-2">
                    {s.numero}
                    {s.estado === 'anulada' && <Badge variant="destructive">Anulada</Badge>}
                  </div>
                </TableCell>
                <TableCell className="font-mono tabular-nums">{series}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{fracciones}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {s.estado === 'activa' ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-muted-foreground hover:text-foreground"
                          aria-label={`Editar ${etiqueta}`}
                          title={`Editar ${alcance}`}
                          onClick={() => onEdit(row.sales)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Anular ${etiqueta}`}
                          title={`Anular ${alcance}`}
                          onClick={() => onVoid(row.sales)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-primary hover:bg-primary/10"
                          aria-label={`Recuperar ${etiqueta} anuladas`}
                          title={`Recuperar ${alcance} anuladas`}
                          onClick={() => onRestore(row.sales)}
                        >
                          <RotateCcw className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Borrar definitivamente ${etiqueta} anuladas`}
                          title="Borrar definitivamente"
                          onClick={() => onDelete(row.sales)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </section>
  )
}
