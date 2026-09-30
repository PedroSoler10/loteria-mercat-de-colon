'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { filterByDay, formatDia, toDateInput, type Sale } from '@/lib/tpv-data'
import { SaleRow, SaleRowsHeader, buildRows, type SaleGroupActions } from './tpv-sale-rows'

type Props = { sales: Sale[] } & SaleGroupActions

export function TpvDayTable({ sales, onEdit, onVoid, onRestore, onDelete }: Props) {
  const today = toDateInput()
  const [day, setDay] = useState(today)
  const daySales = useMemo(() => filterByDay(sales, day), [sales, day])
  const rows = useMemo(() => buildRows(daySales), [daySales])
  const isToday = day === today

  return (
    <section aria-labelledby="ventas-dia-title" className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-3">
        <div className="flex flex-col">
          <h2 id="ventas-dia-title" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Ventas
          </h2>
          <span className="text-sm text-foreground">
            {daySales.length} {daySales.length === 1 ? 'fracción vendida' : 'fracciones vendidas'}
            {' · '}{formatDia(day)}
          </span>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="ventas-dia" className="text-xs text-muted-foreground">Día</Label>
            <Input
              id="ventas-dia"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value || today)}
              className="h-9 font-mono tabular-nums"
            />
          </div>
          {!isToday && (
            <Button type="button" variant="outline" className="h-9" onClick={() => setDay(today)}>
              Hoy
            </Button>
          )}
        </div>
      </div>

      <Table className="min-w-[720px] table-auto text-base">
        <SaleRowsHeader />
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                {isToday ? 'No hay ventas registradas hoy.' : 'No hay ventas registradas este día.'}
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
