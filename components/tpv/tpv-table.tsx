'use client'

import { ChevronRight, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { eur, formatFechaHora, type Sale } from '@/lib/tpv-data'

type Props = {
  sales: Sale[]
  onEdit: (sale: Sale) => void
  onVoid: (sale: Sale) => void
  onRestore: (sale: Sale) => void
  onDelete: (sale: Sale) => void
}

function dateKey(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthKey(date: Date) {
  return dateKey(date).slice(0, 7)
}

function weekKey(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return dateKey(start)
}

function monthLabel(key: string) {
  return new Date(`${key}-01T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

function weekLabel(key: string) {
  const start = new Date(`${key}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `Semana del ${start.toLocaleDateString('es-ES')} al ${end.toLocaleDateString('es-ES')}`
}

function dayLabel(key: string) {
  return new Date(`${key}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

export function TpvTable({ sales, onEdit, onVoid, onRestore, onDelete }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const groups = useMemo(() => {
    const months = new Map<string, Map<string, Map<string, Sale[]>>>()
    for (const sale of sales) {
      const date = new Date(sale.fecha)
      const m = monthKey(date)
      const w = weekKey(date)
      const d = dateKey(date)
      if (!months.has(m)) months.set(m, new Map())
      if (!months.get(m)!.has(w)) months.get(m)!.set(w, new Map())
      if (!months.get(m)!.get(w)!.has(d)) months.get(m)!.get(w)!.set(d, [])
      months.get(m)!.get(w)!.get(d)!.push(sale)
    }
    return Array.from(months.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [sales])
  const allKeys = groups.flatMap(([month, weeks]) => [month, ...Array.from(weeks.entries()).flatMap(([week, days]) => [week, ...Array.from(days.keys())])])
  const allExpanded = groups.length > 0 && allKeys.every((key) => expanded.has(key))
  function toggleAll() {
    setExpanded(allExpanded ? new Set() : new Set(allKeys))
  }
  return (
    <section aria-labelledby="historial-title" className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex flex-col">
          <h2 id="historial-title" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Historial transaccional
          </h2>
          <span className="text-sm text-foreground">
            {sales.length} venta{sales.length !== 1 && 's'} · orden cronológico descendente
          </span>
        </div>
        <Button type="button" variant="outline" onClick={toggleAll}>{allExpanded ? 'Contraer todo' : 'Expandir todo'}</Button>
      </div>

      <Table className="min-w-[920px] table-auto text-base">
        <colgroup>
          {Array.from({ length: 6 }, (_, index) => <col key={index} className="w-1/6" />)}
        </colgroup>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Fecha y hora</TableHead>
            <TableHead>Número</TableHead>
            <TableHead>Serie</TableHead>
            <TableHead className="text-right">Fracción</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No hay ventas registradas en este periodo.
              </TableCell>
            </TableRow>
          )}
          {groups.map(([month, weeks]) => {
            const monthSales = Array.from(weeks.values()).flatMap((days) => Array.from(days.values()).flat())
            const monthOpen = expanded.has(month)
            return <Fragment key={month}>
              <TableRow className="cursor-pointer bg-muted/30 hover:bg-muted/50" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(month)) next.delete(month); else next.add(month); return next })}>
                <TableCell colSpan={4} className="font-semibold capitalize"><div className="flex items-center gap-2"><ChevronRight className={`size-4 transition-transform ${monthOpen ? 'rotate-90' : ''}`} />{monthLabel(month)}</div></TableCell><TableCell className="text-right font-mono tabular-nums">{monthSales.length} ventas</TableCell><TableCell />
              </TableRow>
              {monthOpen && Array.from(weeks.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([week, days]) => {
                const weekSales = Array.from(days.values()).flat()
                const weekOpen = expanded.has(week)
                return <Fragment key={week}>
                  <TableRow className="cursor-pointer bg-muted/20 hover:bg-muted/40" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(week)) next.delete(week); else next.add(week); return next })}>
                    <TableCell colSpan={4} className="pl-10 font-semibold capitalize"><div className="flex items-center gap-2"><ChevronRight className={`size-4 transition-transform ${weekOpen ? 'rotate-90' : ''}`} />{weekLabel(week)}</div></TableCell><TableCell className="text-right font-mono tabular-nums">{weekSales.length} ventas</TableCell><TableCell />
                  </TableRow>
                  {weekOpen && Array.from(days.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([day, group]) => {
                    const dayOpen = expanded.has(day)
                    return <Fragment key={day}>
                      <TableRow className="cursor-pointer bg-muted/10 hover:bg-muted/30" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(day)) next.delete(day); else next.add(day); return next })}>
                        <TableCell colSpan={4} className="pl-20 font-semibold capitalize"><div className="flex items-center gap-2"><ChevronRight className={`size-4 transition-transform ${dayOpen ? 'rotate-90' : ''}`} />{dayLabel(day)}</div></TableCell><TableCell className="text-right font-mono tabular-nums">{group.length} ventas</TableCell><TableCell />
                      </TableRow>
                      {dayOpen && group.map((s) => {
            const { fecha, hora } = formatFechaHora(s.fecha)
            return (
              <TableRow key={s.id} className={s.estado === 'anulada' ? 'group opacity-70' : 'group'}>
                <TableCell className="font-mono tabular-nums">
                  <span className="text-foreground">{fecha}</span>
                  <span className="ml-2 text-muted-foreground">{hora}</span>
                </TableCell>
                <TableCell className="font-mono text-base font-semibold tabular-nums">
                  <div className="flex items-center gap-2">
                    {s.numero}
                    {s.estado === 'anulada' && <Badge variant="destructive">Anulada</Badge>}
                  </div>
                </TableCell>
                <TableCell className="font-mono tabular-nums">{s.serie}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{s.fraccion}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{eur.format(s.precio)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {s.estado === 'activa' ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-muted-foreground hover:text-foreground"
                          aria-label={`Editar venta ${s.numero} serie ${s.serie} fracción ${s.fraccion}`}
                          onClick={() => onEdit(s)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Anular venta ${s.numero} serie ${s.serie} fracción ${s.fraccion}`}
                          onClick={() => onVoid(s)}
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
                          aria-label={`Revertir venta anulada ${s.numero} serie ${s.serie} fracción ${s.fraccion}`}
                          title="Revertir venta anulada"
                          onClick={() => onRestore(s)}
                        >
                          <RotateCcw className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Borrar definitivamente venta anulada ${s.numero} serie ${s.serie} fracción ${s.fraccion}`}
                          title="Borrar definitivamente"
                          onClick={() => onDelete(s)}
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
                    </Fragment>
                  })}
                </Fragment>
              })}
            </Fragment>
          })}
        </TableBody>
      </Table>
    </section>
  )
}
