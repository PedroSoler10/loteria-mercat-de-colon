'use client'

import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { filterByPeriodo, formatFechaHora, formatFracciones, type Sale } from '@/lib/tpv-data'

type Props = {
  sales: Sale[]
  onEdit: (sales: Sale[]) => void
  onVoid: (sales: Sale[]) => void
  onRestore: (sales: Sale[]) => void
  onDelete: (sales: Sale[]) => void
}

/** Una fila agrupa las ventas del mismo número, serie, estado y minuto. */
type Row = { key: string; sales: Sale[] }

function buildRows(sales: Sale[]): Row[] {
  const groups = new Map<string, Sale[]>()
  for (const sale of sales) {
    const minute = sale.fecha.slice(0, 16)
    const key = `${sale.numero}|${sale.serie}|${sale.estado}|${sale.sorteo}|${minute}`
    const group = groups.get(key)
    if (group) group.push(sale)
    else groups.set(key, [sale])
  }
  return Array.from(groups, ([key, group]) => ({
    key,
    sales: [...group].sort((a, b) => Number(a.fraccion) - Number(b.fraccion)),
  })).sort((a, b) => latest(b).localeCompare(latest(a)) || a.key.localeCompare(b.key))
}

function latest(row: Row) {
  return row.sales.reduce((max, sale) => (sale.fecha > max ? sale.fecha : max), '')
}

export function TpvTodayTable({ sales, onEdit, onVoid, onRestore, onDelete }: Props) {
  const todaySales = useMemo(() => filterByPeriodo(sales, 'hoy'), [sales])
  const rows = useMemo(() => buildRows(todaySales), [todaySales])

  return (
    <section aria-labelledby="ventas-hoy-title" className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-col border-b px-5 py-3">
        <h2 id="ventas-hoy-title" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Ventas de hoy
        </h2>
        <span className="text-sm text-foreground">
          {todaySales.length} {todaySales.length === 1 ? 'fracción vendida' : 'fracciones vendidas'} · más recientes primero
        </span>
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
                No hay ventas registradas hoy.
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => {
            const s = row.sales[0]
            const { fecha, hora } = formatFechaHora(s.fecha)
            const fracciones = formatFracciones(row.sales.map((sale) => Number(sale.fraccion)))
            const varias = row.sales.length > 1
            const etiqueta = `${s.numero} serie ${s.serie} ${varias ? 'fracciones' : 'fracción'} ${fracciones}`
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
                <TableCell className="font-mono tabular-nums">{s.serie}</TableCell>
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
