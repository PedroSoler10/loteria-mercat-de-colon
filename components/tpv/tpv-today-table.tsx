'use client'

import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { filterByPeriodo, formatFechaHora, type Sale } from '@/lib/tpv-data'

type Props = {
  sales: Sale[]
  onEdit: (sale: Sale) => void
  onVoid: (sale: Sale) => void
  onRestore: (sale: Sale) => void
  onDelete: (sale: Sale) => void
}

export function TpvTodayTable({ sales, onEdit, onVoid, onRestore, onDelete }: Props) {
  const todaySales = useMemo(
    () => filterByPeriodo(sales, 'hoy').sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [sales],
  )

  return (
    <section aria-labelledby="ventas-hoy-title" className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-col border-b px-5 py-3">
        <h2 id="ventas-hoy-title" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Ventas de hoy
        </h2>
        <span className="text-sm text-foreground">
          {todaySales.length} venta{todaySales.length !== 1 && 's'} · más recientes primero
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
          {todaySales.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No hay ventas registradas hoy.
              </TableCell>
            </TableRow>
          )}
          {todaySales.map((s) => {
            const { fecha, hora } = formatFechaHora(s.fecha)
            const etiqueta = `${s.numero} serie ${s.serie} fracción ${s.fraccion}`
            return (
              <TableRow key={s.id} className={s.estado === 'anulada' ? 'opacity-70' : undefined}>
                <TableCell className="font-mono tabular-nums">{fecha}</TableCell>
                <TableCell className="font-mono tabular-nums">{hora}</TableCell>
                <TableCell className="font-mono text-base font-semibold tabular-nums">
                  <div className="flex items-center gap-2">
                    {s.numero}
                    {s.estado === 'anulada' && <Badge variant="destructive">Anulada</Badge>}
                  </div>
                </TableCell>
                <TableCell className="font-mono tabular-nums">{s.serie}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{s.fraccion}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {s.estado === 'activa' ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-muted-foreground hover:text-foreground"
                          aria-label={`Editar venta ${etiqueta}`}
                          title="Editar venta"
                          onClick={() => onEdit(s)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Anular venta ${etiqueta}`}
                          title="Anular venta"
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
                          aria-label={`Recuperar venta anulada ${etiqueta}`}
                          title="Recuperar venta anulada"
                          onClick={() => onRestore(s)}
                        >
                          <RotateCcw className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Borrar definitivamente venta anulada ${etiqueta}`}
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
        </TableBody>
      </Table>
    </section>
  )
}
