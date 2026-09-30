'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { filterByRange, rangeBounds, toDateInput, type RangoVentas, type Sale } from '@/lib/tpv-data'
import { SaleRow, SaleRowsHeader, buildRows, type SaleGroupActions } from './tpv-sale-rows'

type Props = { sales: Sale[] } & SaleGroupActions

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
        <SaleRowsHeader />
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                {invalidRange ? 'Elige una fecha inicial anterior o igual a la final.' : rango === 'hoy' ? 'No hay ventas registradas hoy.' : 'No hay ventas registradas en este periodo.'}
              </TableCell>
            </TableRow>
          )}
          {rows.map((group) => (
            <SaleRow key={group.key} group={group} onEdit={onEdit} onVoid={onVoid} onRestore={onRestore} onDelete={onDelete} />
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
