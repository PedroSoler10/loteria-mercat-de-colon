'use client'

import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
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

export function TpvTable({ sales, onEdit, onVoid, onRestore, onDelete }: Props) {
  return (
    <section aria-labelledby="historial-title" className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex flex-col">
          <h2 id="historial-title" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Historial transaccional
          </h2>
          <span className="text-sm text-foreground">
            {sales.length} venta{sales.length !== 1 && 's'} · orden cronológico descendente
          </span>
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
          {sales.map((s) => {
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
        </TableBody>
      </Table>
    </section>
  )
}
