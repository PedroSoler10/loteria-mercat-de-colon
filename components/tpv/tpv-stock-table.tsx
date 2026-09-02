'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { countStock, groupTickets, ticketId, type NumeroNode, type Ticket } from '@/lib/inventory-data'
import { SellControl } from './sell-control'

type Props = {
  tickets: Ticket[]
  /** Números que deben aparecer desplegados (p. ej. resultado de búsqueda). */
  autoExpand?: string[]
  onSell: (ticketIds: string[]) => void
}

function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <ChevronRight
      aria-hidden="true"
      className={cn('size-5 shrink-0 transition-transform duration-150', open && 'rotate-90', className)}
    />
  )
}

function Counts({ list, strong }: { list: Ticket[]; strong?: boolean }) {
  const c = countStock(list)
  return (
    <>
      <TableCell className={cn('text-right font-mono tabular-nums', strong && 'text-base')}>{c.recibidos}</TableCell>
      <TableCell className={cn('text-right font-mono tabular-nums text-muted-foreground', strong && 'text-base')}>
        {c.vendidos}
      </TableCell>
      <TableCell className="text-right">
        <span
          className={cn(
            'inline-flex min-w-9 justify-center rounded-md px-2 py-0.5 font-mono font-semibold tabular-nums',
            c.disponibles === 0
              ? 'bg-muted text-muted-foreground'
              : c.disponibles <= 3
                ? 'bg-accent/30 text-accent-foreground'
                : 'bg-primary/10 text-primary',
            strong && 'text-base',
          )}
        >
          {c.disponibles}
        </span>
      </TableCell>
    </>
  )
}

const COLS = 7

export function TpvStockTable({ tickets, autoExpand, onSell }: Props) {
  const numeros = useMemo(() => groupTickets(tickets), [tickets])
  const [openNumeros, setOpenNumeros] = useState<Set<string>>(new Set())
  const [openSeries, setOpenSeries] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (autoExpand && autoExpand.length > 0) {
      setOpenNumeros(new Set(autoExpand))
    }
  }, [autoExpand])

  function toggle(set: Set<string>, key: string, apply: (s: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    apply(next)
  }

  function expandAll() {
    setOpenNumeros(new Set(numeros.map((n) => n.numero)))
    setOpenSeries(new Set(numeros.flatMap((n) => n.series.map((s) => `${n.numero}/${s.serie}`))))
  }

  function collapseAll() {
    setOpenNumeros(new Set())
    setOpenSeries(new Set())
  }

  /** Vende las N primeras fracciones disponibles de una lista. */
  function sellFrom(list: Ticket[], qty: number) {
    const ids = list.filter((t) => !t.vendido).slice(0, qty).map(ticketId)
    if (ids.length > 0) onSell(ids)
  }

  function allTickets(n: NumeroNode) {
    return n.series.flatMap((s) => s.fracciones)
  }

  return (
    <section aria-labelledby="tpv-table-title" className="flex flex-col gap-3 rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-baseline gap-3">
          <h2 id="tpv-table-title" className="text-lg font-semibold">
            Stock y venta
          </h2>
          <span className="text-sm text-muted-foreground">
            {numeros.length} número{numeros.length !== 1 && 's'} · {tickets.length} boletos
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10" onClick={expandAll}>
            Desplegar todo
          </Button>
          <Button variant="outline" className="h-10" onClick={collapseAll}>
            Contraer todo
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[1240px] table-auto text-base">
          <colgroup>
            {Array.from({ length: COLS }, (_, index) => <col key={index} className="w-1/7" />)}
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>Número</TableHead>
              <TableHead>Serie</TableHead>
              <TableHead>Fracción</TableHead>
              <TableHead className="text-right">Recibidos</TableHead>
              <TableHead className="text-right">Vendidos</TableHead>
              <TableHead className="text-right">Disponibles</TableHead>
              <TableHead className="pr-5 text-right">Acción (Venta)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {numeros.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLS} className="h-24 text-center text-muted-foreground">
                  Ningún número coincide con la búsqueda.
                </TableCell>
              </TableRow>
            )}
            {numeros.map((n) => {
              const numOpen = openNumeros.has(n.numero)
              const all = allTickets(n)
              const first = all[0]
              const avail = all.filter((t) => !t.vendido).length
              return (
                <Fragment key={n.numero}>
                  {/* Nivel 1: número */}
                  <TableRow
                    className={cn('cursor-pointer bg-card', numOpen && 'bg-primary/5 hover:bg-primary/5')}
                    onClick={() => toggle(openNumeros, n.numero, setOpenNumeros)}
                  >
                    <TableCell className="p-1">
                      <button
                        type="button"
                        aria-expanded={numOpen}
                        aria-label={`${numOpen ? 'Contraer' : 'Desplegar'} número ${n.numero}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggle(openNumeros, n.numero, setOpenNumeros)
                        }}
                        className="flex h-10 items-center gap-2 rounded-md px-2 text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <Chevron open={numOpen} />
                        <span className="font-mono text-lg font-semibold tabular-nums tracking-wide">{n.numero}</span>
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {n.series.length} serie{n.series.length !== 1 && 's'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <Counts list={all} strong />
                    <TableCell className="pr-5">
                      <SellControl max={avail} label={`Vender número ${n.numero}`} onSell={(q) => sellFrom(all, q)} />
                    </TableCell>
                  </TableRow>

                  {/* Nivel 2: series */}
                  {numOpen &&
                    n.series.map((s) => {
                      const key = `${n.numero}/${s.serie}`
                      const serOpen = openSeries.has(key)
                      const sAvail = s.fracciones.filter((t) => !t.vendido).length
                      return (
                        <Fragment key={key}>
                          <TableRow
                            className={cn('cursor-pointer bg-muted/30', serOpen && 'bg-muted/60 hover:bg-muted/60')}
                            onClick={() => toggle(openSeries, key, setOpenSeries)}
                          >
                            <TableCell>
                              <span className="ml-3 block border-l-2 border-primary/20 pl-4 font-mono text-sm text-muted-foreground tabular-nums">
                                {n.numero}
                              </span>
                            </TableCell>
                            <TableCell className="p-1">
                              <button
                                type="button"
                                aria-expanded={serOpen}
                                aria-label={`${serOpen ? 'Contraer' : 'Desplegar'} serie ${s.serie} del número ${n.numero}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggle(openSeries, key, setOpenSeries)
                                }}
                                className="flex h-9 items-center gap-2 rounded-md px-2 text-foreground hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"
                              >
                                <Chevron open={serOpen} className="size-4" />
                                <span className="font-mono font-semibold tabular-nums">{s.serie}</span>
                              </button>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{s.fracciones.length} fracc.</TableCell>
                            <Counts list={s.fracciones} />
                            <TableCell className="pr-5">
                              <SellControl
                                size="md"
                                max={sAvail}
                                label={`Vender serie ${s.serie} del número ${n.numero}`}
                                onSell={(q) => sellFrom(s.fracciones, q)}
                              />
                            </TableCell>
                          </TableRow>

                          {/* Nivel 3: fracciones */}
                          {serOpen &&
                            s.fracciones.map((f) => (
                              <TableRow
                                key={ticketId(f)}
                                className={cn('bg-card', f.vendido && 'text-muted-foreground')}
                              >
                                <TableCell>
                                  <span className="ml-3 block border-l-2 border-primary/20 pl-4 font-mono text-muted-foreground tabular-nums">
                                    {f.numero}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className="ml-3 block border-l-2 border-primary/20 pl-4 font-mono text-muted-foreground tabular-nums">
                                    {f.serie}
                                  </span>
                                </TableCell>
                                <TableCell className="font-mono font-semibold tabular-nums">{f.fraccion}</TableCell>
                                <TableCell className="text-right font-mono tabular-nums">1</TableCell>
                                <TableCell className="text-right font-mono tabular-nums">{f.vendido ? 1 : 0}</TableCell>
                                <TableCell className="text-right font-mono tabular-nums">{f.vendido ? 0 : 1}</TableCell>
                                <TableCell className="pr-5 text-right">
                                  {f.vendido ? (
                                    <Badge variant="secondary" className="gap-1 px-3 py-1.5">
                                      <Check className="size-3.5" aria-hidden="true" />
                                      Vendido
                                    </Badge>
                                  ) : (
                                    <Button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onSell([ticketId(f)])
                                      }}
                                      className="h-9 bg-accent px-4 font-semibold text-accent-foreground shadow-sm hover:bg-accent/90"
                                    >
                                      Vender
                                    </Button>
                                  )}
                                </TableCell>
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
