'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { eur, formatFechaHora, type Sale } from '@/lib/tpv-data'

export function CedidoTable({ cedidos }: { cedidos: Sale[] }) {
  return (
    <section aria-labelledby="cedidos-title" className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex flex-col">
          <h2 id="cedidos-title" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Cedidos</h2>
          <span className="text-sm text-foreground">{cedidos.length} cedido{cedidos.length !== 1 && 's'} · orden cronológico descendente</span>
        </div>
      </div>
      <Table className="min-w-[920px] table-auto text-base">
        <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableHead>Fecha y hora</TableHead><TableHead>Número</TableHead><TableHead>Serie</TableHead>
          <TableHead className="text-right">Fracción</TableHead><TableHead className="text-right">Precio</TableHead><TableHead>Estado</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {cedidos.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No hay cedidos registrados.</TableCell></TableRow>}
          {cedidos.map((cedido) => {
            const { fecha, hora } = formatFechaHora(cedido.fecha)
            return <TableRow key={cedido.id}>
              <TableCell className="font-mono tabular-nums"><span>{fecha}</span><span className="ml-2 text-muted-foreground">{hora}</span></TableCell>
              <TableCell className="font-mono text-base font-semibold tabular-nums">{cedido.numero}</TableCell>
              <TableCell className="font-mono tabular-nums">{cedido.serie}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{cedido.fraccion}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{eur.format(cedido.precio)}</TableCell>
              <TableCell>Activo</TableCell>
            </TableRow>
          })}
        </TableBody>
      </Table>
    </section>
  )
}
