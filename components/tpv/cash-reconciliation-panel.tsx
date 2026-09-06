'use client'

import { Banknote, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { eur, startOfPeriod, type Periodo } from '@/lib/tpv-data'

type Props = {
  periodo: Periodo
  onPeriodoChange: (p: Periodo) => void
  ingresos: number
  decimos: number
  operaciones: number
}

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mes' },
]

export function CashReconciliationPanel({ periodo, onPeriodoChange, ingresos, decimos, operaciones }: Props) {
  const desde = startOfPeriod(periodo)
  const rango =
    periodo === 'hoy'
      ? desde.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      : `desde el ${desde.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`

  return (
    <section aria-labelledby="arqueo-title" className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-3">
        <div className="flex flex-col">
          <h2 id="arqueo-title" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Arqueo de caja
          </h2>
          <span className="text-sm capitalize text-foreground">{rango}</span>
        </div>

        <div role="tablist" aria-label="Periodo del arqueo" className="flex rounded-md border bg-muted p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              role="tab"
              aria-selected={periodo === p.value}
              onClick={() => onPeriodoChange(p.value)}
              className={cn(
                'h-9 rounded px-4 text-sm font-medium transition-colors',
                periodo === p.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3" aria-live="polite">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-primary bg-primary px-5 py-4 text-primary-foreground md:col-span-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest opacity-80">Ingresos totales</span>
            <span className="font-mono text-5xl font-semibold tabular-nums leading-none">{eur.format(ingresos)}</span>
            <span className="mt-1 text-sm opacity-80">
              {operaciones} operaci{operaciones === 1 ? 'ón' : 'ones'} registrada{operaciones === 1 ? '' : 's'}
            </span>
          </div>
          <Banknote aria-hidden="true" className="size-8 opacity-70" />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-accent bg-accent px-5 py-4 text-accent-foreground">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest opacity-80">Décimos vendidos</span>
            <span className="font-mono text-5xl font-semibold tabular-nums leading-none">
              {decimos.toLocaleString('es-ES')}
            </span>
            <span className="mt-1 text-sm opacity-80">a {eur.format(decimos ? ingresos / decimos : 0)} de media</span>
          </div>
          <Ticket aria-hidden="true" className="size-8 opacity-70" />
        </div>
      </div>
    </section>
  )
}
