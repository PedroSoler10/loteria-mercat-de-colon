'use client'

import { useMemo, useState } from 'react'
import { InventoryMetrics } from '@/components/inventory/inventory-metrics'
import { CashReconciliationPanel } from '@/components/tpv/cash-reconciliation-panel'
import { countStock, type Cedido, type Ticket } from '@/lib/record-data'
import type { Periodo, Sale } from '@/lib/tpv-data'

type Props = {
  tickets: Ticket[]
  sales: Sale[]
  cedidos: Cedido[]
}

type DailySales = {
  date: string
  label: string
  count: number
}

function getDailySales(sales: Sale[]): DailySales[] {
  const grouped = new Map<string, number>()
  for (const sale of sales) {
    const date = new Date(sale.fecha)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    grouped.set(key, (grouped.get(key) ?? 0) + 1)
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      count,
    }))
}

export function AnalysisTab({ tickets, sales, cedidos }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const periodSales = useMemo(() => {
    const now = new Date()
    const from = new Date(now)
    from.setHours(0, 0, 0, 0)
    if (periodo === 'semana') {
      const day = (from.getDay() + 6) % 7
      from.setDate(from.getDate() - day)
    } else if (periodo === 'mes') {
      from.setDate(1)
    }
    return sales.filter((sale) => sale.estado === 'activa' && new Date(sale.fecha).getTime() >= from.getTime())
  }, [sales, periodo])
  const activeSales = useMemo(() => sales.filter((sale) => sale.estado === 'activa'), [sales])
  const dailySales = useMemo(() => getDailySales(activeSales), [activeSales])
  const maxCount = Math.max(...dailySales.map((day) => day.count), 1)

  return (
    <div className="flex flex-col gap-5">
      <InventoryMetrics counts={{ ...countStock(tickets), cedidos: cedidos.length }} />
      <CashReconciliationPanel
        periodo={periodo}
        onPeriodoChange={setPeriodo}
        ingresos={periodSales.reduce((total, sale) => total + sale.precio, 0)}
        decimos={periodSales.length}
        operaciones={periodSales.length}
      />

      <section aria-labelledby="daily-sales-title" className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="daily-sales-title" className="text-lg font-semibold">Fracciones vendidas por día</h2>
            <p className="text-sm text-muted-foreground">Cada fracción vendida cuenta como una operación.</p>
          </div>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {activeSales.length} fracciones activas en total
          </span>
        </div>

        {dailySales.length === 0 ? (
          <p className="flex min-h-52 items-center justify-center text-muted-foreground">Todavía no hay ventas registradas.</p>
        ) : (
          <div className="mt-8 flex min-h-64 items-end gap-2 overflow-x-auto border-b border-l px-4 pb-0 pt-4">
            {dailySales.map((day) => (
              <div key={day.date} className="flex h-56 min-w-16 flex-1 flex-col items-center justify-end gap-2">
                <span className="font-mono text-sm font-semibold tabular-nums">{day.count}</span>
                <div
                  role="img"
                  aria-label={`${day.count} fracciones vendidas el ${day.label}`}
                  className="w-full max-w-14 rounded-t-md bg-primary transition-[height]"
                  style={{ height: `${Math.max((day.count / maxCount) * 100, 5)}%` }}
                />
                <span className="whitespace-nowrap text-xs capitalize text-muted-foreground">{day.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}