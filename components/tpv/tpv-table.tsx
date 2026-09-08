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

type Grouping = 'day' | 'week' | 'month'

function groupKey(date: Date, grouping: Grouping) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (grouping === 'month') return localDate.slice(0, 7)
  if (grouping === 'week') {
    const day = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - day)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return localDate
}

function groupLabel(key: string, grouping: Grouping) {
  const date = new Date(`${key}${grouping === 'month' ? '-01' : ''}T12:00:00`)
  if (grouping === 'month') return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  if (grouping === 'week') {
    const end = new Date(date)
    end.setDate(end.getDate() + 6)
    return `Semana del ${date.toLocaleDateString('es-ES')} al ${end.toLocaleDateString('es-ES')}`
  }
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

export function TpvTable({ sales, onEdit, onVoid, onRestore, onDelete }: Props) {
  const [grouping, setGrouping] = useState<Grouping>('day')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const groups = useMemo(() => {
    const map = new Map<string, Sale[]>()
    for (const sale of sales) {
      const key = groupKey(new Date(sale.fecha), grouping)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(sale)
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [sales, grouping])
  const allExpanded = groups.length > 0 && groups.every(([key]) => expanded.has(key))
  function toggleAll() {
    setExpanded(allExpanded ? new Set() : new Set(groups.map(([key]) => key)))
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border bg-muted p-1">
            {(['day', 'week', 'month'] as Grouping[]).map((value) => (
              <Button key={value} type="button" variant="ghost" className={grouping === value ? 'bg-card text-primary shadow-sm' : ''} onClick={() => { setGrouping(value); setExpanded(new Set()) }}>
                {value === 'day' ? 'Días' : value === 'week' ? 'Semanas' : 'Meses'}
              </Button>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={toggleAll}>{allExpanded ? 'Contraer todo' : 'Expandir todo'}</Button>
        </div>
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
          {groups.map(([key, group]) => {
            const isExpanded = expanded.has(key)
            return (
              <Fragment key={`group-fragment-${key}`}>
                <TableRow key={`group-${key}`} className="cursor-pointer bg-muted/30 hover:bg-muted/50" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })}>
                  <TableCell colSpan={4} className="font-semibold capitalize"><div className="flex items-center gap-2"><ChevronRight className={`size-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />{groupLabel(key, grouping)}</div></TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{group.length} ventas</TableCell><TableCell />
                </TableRow>
                {isExpanded && group.map((s) => {
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
            )
          })}
        </TableBody>
      </Table>
    </section>
  )
}
