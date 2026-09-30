'use client'

import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatFechaHora, formatFracciones, formatSeries, type Sale } from '@/lib/tpv-data'

/**
 * Una fila agrupa las ventas del mismo número, serie, estado y minuto.
 * Además, las series completas (fracciones 1 a 10) del mismo número, estado y minuto se juntan en una sola fila.
 */
export type SaleGroup = { key: string; sales: Sale[] }

export type SaleGroupActions = {
  onEdit: (sales: Sale[]) => void
  onVoid: (sales: Sale[]) => void
  onRestore: (sales: Sale[]) => void
  onDelete: (sales: Sale[]) => void
}

const FRACCIONES_SERIE_COMPLETA = 10

function isCompleteSeries(group: Sale[]) {
  const fractions = new Set(group.map((sale) => Number(sale.fraccion)))
  return group.length === FRACCIONES_SERIE_COMPLETA && Array.from({ length: FRACCIONES_SERIE_COMPLETA }, (_, index) => index + 1).every((n) => fractions.has(n))
}

function latest(group: SaleGroup) {
  return group.sales.reduce((max, sale) => (sale.fecha > max ? sale.fecha : max), '')
}

export function buildRows(sales: Sale[]): SaleGroup[] {
  const groups = new Map<string, Sale[]>()
  for (const sale of sales) {
    const minute = sale.fecha.slice(0, 16)
    const key = `${sale.numero}|${sale.serie}|${sale.estado}|${sale.sorteo}|${minute}`
    const group = groups.get(key)
    if (group) group.push(sale)
    else groups.set(key, [sale])
  }

  const rows: SaleGroup[] = []
  const completeByMinute = new Map<string, SaleGroup[]>()
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

export function SaleRowsHeader() {
  return (
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
  )
}

export function SaleRow({ group, onEdit, onVoid, onRestore, onDelete }: { group: SaleGroup } & SaleGroupActions) {
  const s = group.sales[0]
  const { fecha, hora } = formatFechaHora(s.fecha)
  const fracciones = formatFracciones(group.sales.map((sale) => Number(sale.fraccion)))
  const series = formatSeries(group.sales.map((sale) => Number(sale.serie)))
  const varias = group.sales.length > 1
  const etiqueta = `${s.numero} ${series.includes('-') || series.includes(',') ? 'series' : 'serie'} ${series} ${varias ? 'fracciones' : 'fracción'} ${fracciones}`
  const alcance = varias ? 'las ventas del grupo' : 'la venta'
  return (
    <TableRow className={s.estado === 'anulada' ? 'opacity-70' : undefined}>
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
                onClick={() => onEdit(group.sales)}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Anular ${etiqueta}`}
                title={`Anular ${alcance}`}
                onClick={() => onVoid(group.sales)}
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
                onClick={() => onRestore(group.sales)}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Borrar definitivamente ${etiqueta} anuladas`}
                title="Borrar definitivamente"
                onClick={() => onDelete(group.sales)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
