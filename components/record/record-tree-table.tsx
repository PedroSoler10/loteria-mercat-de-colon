'use client'

import { Fragment, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { albaranes, groupTickets, type Ticket } from '@/lib/record-data'

type Props = {
  tickets: Ticket[]
}

function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <ChevronRight
      aria-hidden="true"
      className={cn('size-5 shrink-0 transition-transform duration-150', open && 'rotate-90', className)}
    />
  )
}

function getAlbaranName(id: string) {
  return albaranes.find((albaran) => albaran.idOrigen === id)?.nombre ?? id
}

const COLS = 5

export function RecordTreeTable({ tickets }: Props) {
  const numeros = useMemo(() => groupTickets(tickets), [tickets])
  const [openNumeros, setOpenNumeros] = useState<Set<string>>(new Set())
  const [openSeries, setOpenSeries] = useState<Set<string>>(new Set())

  function toggle(set: Set<string>, key: string, apply: (next: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    apply(next)
  }

  function expandAll() {
    setOpenNumeros(new Set(numeros.map((numero) => numero.numero)))
    setOpenSeries(new Set(numeros.flatMap((numero) => numero.series.map((serie) => `${numero.numero}/${serie.serie}`))))
  }

  function collapseAll() {
    setOpenNumeros(new Set())
    setOpenSeries(new Set())
  }

  return (
    <section aria-labelledby="tree-title" className="flex flex-col gap-3 rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-baseline gap-3">
          <h2 id="tree-title" className="text-lg font-semibold">Inventario actual</h2>
          <span className="text-sm text-muted-foreground">{numeros.length} números · {tickets.length} boletos</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10" onClick={expandAll}>Desplegar todo</Button>
          <Button variant="outline" className="h-10" onClick={collapseAll}>Contraer todo</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[720px] table-auto text-base">
          <colgroup>
            <col className="w-1/5" />
            <col className="w-1/5" />
            <col className="w-1/5" />
            <col className="w-1/5" />
            <col className="w-1/5" />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="pl-5">Número</TableHead>
              <TableHead>Serie</TableHead>
              <TableHead>Fracción</TableHead>
              <TableHead>Nombre de albarán</TableHead>
              <TableHead className="pr-5">Fecha de emisión</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {numeros.length === 0 && (
              <TableRow><TableCell colSpan={COLS} className="h-24 text-center text-muted-foreground">Sin boletos en inventario.</TableCell></TableRow>
            )}
            {numeros.map((numero) => {
              const numberOpen = openNumeros.has(numero.numero)
              const firstFraction = numero.series[0]?.fracciones[0]
              const albaranNames = Array.from(new Set(numero.series.flatMap((serie) => serie.fracciones.map((fraction) => getAlbaranName(fraction.albaranId)))))
              return (
                <Fragment key={numero.numero}>
                  <TableRow className={cn('cursor-pointer bg-card', numberOpen && 'bg-primary/5 hover:bg-primary/5')} onClick={() => toggle(openNumeros, numero.numero, setOpenNumeros)}>
                    <TableCell className="pl-3">
                      <button type="button" aria-expanded={numberOpen} aria-label={`${numberOpen ? 'Contraer' : 'Desplegar'} número ${numero.numero}`} onClick={(event) => { event.stopPropagation(); toggle(openNumeros, numero.numero, setOpenNumeros) }} className="flex h-10 items-center gap-2 rounded-md px-2 text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring">
                        <Chevron open={numberOpen} />
                        <span className="font-mono text-lg font-semibold tabular-nums tracking-wide">{numero.numero}</span>
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{numero.series.length} serie{numero.series.length !== 1 && 's'}</TableCell>
                    <TableCell className="text-muted-foreground">{numero.totalBoletos} boletos</TableCell>
                    <TableCell>{albaranNames.join(', ')}</TableCell>
                    <TableCell className="pr-5 font-mono tabular-nums text-muted-foreground">{firstFraction?.registrado}</TableCell>
                  </TableRow>

                  {numberOpen && numero.series.map((serie) => {
                    const seriesKey = `${numero.numero}/${serie.serie}`
                    const seriesOpen = openSeries.has(seriesKey)
                    const first = serie.fracciones[0]
                    return (
                      <Fragment key={seriesKey}>
                        <TableRow className={cn('cursor-pointer bg-muted/30', seriesOpen && 'bg-muted/60 hover:bg-muted/60')} onClick={() => toggle(openSeries, seriesKey, setOpenSeries)}>
                          <TableCell className="pl-3"><span className="ml-3 block border-l-2 border-primary/20 pl-4 font-mono text-muted-foreground tabular-nums">{numero.numero}</span></TableCell>
                          <TableCell className="p-1"><button type="button" aria-expanded={seriesOpen} aria-label={`${seriesOpen ? 'Contraer' : 'Desplegar'} serie ${serie.serie} del número ${numero.numero}`} onClick={(event) => { event.stopPropagation(); toggle(openSeries, seriesKey, setOpenSeries) }} className="flex h-9 items-center gap-2 rounded-md px-2 text-foreground hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"><Chevron open={seriesOpen} className="size-4" /><span className="font-mono font-semibold tabular-nums">{serie.serie}</span></button></TableCell>
                          <TableCell className="text-muted-foreground">{serie.fracciones.length} fracciones</TableCell>
                          <TableCell>{getAlbaranName(first?.albaranId ?? '')}</TableCell>
                          <TableCell className="pr-5 font-mono tabular-nums text-muted-foreground">{first?.registrado}</TableCell>
                        </TableRow>
                        {seriesOpen && serie.fracciones.map((fraction) => (
                          <TableRow key={`${seriesKey}/${fraction.fraccion}`} className="bg-card">
                            <TableCell className="pl-3"><span className="ml-3 block border-l-2 border-primary/20 pl-4 font-mono text-muted-foreground tabular-nums">{fraction.numero}</span></TableCell>
                            <TableCell><span className="ml-3 block border-l-2 border-primary/20 pl-4 font-mono text-muted-foreground tabular-nums">{fraction.serie}</span></TableCell>
                            <TableCell className="font-mono font-semibold tabular-nums">{fraction.fraccion}</TableCell>
                            <TableCell>{getAlbaranName(fraction.albaranId)}</TableCell>
                            <TableCell className="pr-5 font-mono tabular-nums text-muted-foreground">{fraction.registrado}</TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    )
                  })}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
