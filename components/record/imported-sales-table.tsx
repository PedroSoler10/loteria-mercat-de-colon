'use client'

import { Fragment, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Sale } from '@/lib/tpv-data'
import { formatFechaHora } from '@/lib/tpv-data'

function dateKey(value: Date | string) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthKey(value: Date | string) {
  return dateKey(value).slice(0, 7)
}

function weekKey(value: Date | string) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return dateKey(date)
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
  return new Date(`${key}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function ImportedSalesTable({ sales }: { sales: Sale[] }) {
  const importedSales = useMemo(() => sales.filter((sale) => sale.importada), [sales])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const draws = new Map<string, Map<string, Map<string, Map<string, Sale[]>>>>()
    for (const sale of importedSales) {
      const date = new Date(sale.fecha)
      const month = monthKey(date)
      const week = weekKey(date)
      const day = dateKey(date)
      if (!draws.has(sale.sorteo)) draws.set(sale.sorteo, new Map())
      const months = draws.get(sale.sorteo)!
      if (!months.has(month)) months.set(month, new Map())
      const weeks = months.get(month)!
      if (!weeks.has(week)) weeks.set(week, new Map())
      const days = weeks.get(week)!
      if (!days.has(day)) days.set(day, [])
      days.get(day)!.push(sale)
    }
    return Array.from(draws.entries()).sort(([a], [b]) => a.localeCompare(b, 'es'))
  }, [importedSales])

  const allKeys = groups.flatMap(([draw, months]) => [
    draw,
    ...Array.from(months.entries()).flatMap(([month, weeks]) => [
      `${draw}/${month}`,
      ...Array.from(weeks.entries()).flatMap(([week, days]) => [
        `${draw}/${month}/${week}`,
        ...Array.from(days.keys()).map((day) => `${draw}/${month}/${week}/${day}`),
      ]),
    ]),
  ])
  const allExpanded = allKeys.length > 0 && allKeys.every((key) => expanded.has(key))

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <section aria-labelledby="imported-sales-title" className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 id="imported-sales-title" className="text-lg font-semibold">Ventas importadas</h2>
          <span className="text-sm text-muted-foreground">{importedSales.length} ventas</span>
        </div>
        <Button type="button" variant="outline" onClick={() => setExpanded(allExpanded ? new Set() : new Set(allKeys))}>
          {allExpanded ? 'Contraer todo' : 'Expandir todo'}
        </Button>
      </div>
      <Table className="min-w-[760px] table-fixed">
        <colgroup>
          <col style={{ width: '38%' }} />
          <col style={{ width: '27%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            <TableHead>Fecha y hora</TableHead>
            <TableHead>Número</TableHead>
            <TableHead>Serie</TableHead>
            <TableHead>Fracción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 && <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No hay ventas importadas.</TableCell></TableRow>}
          {groups.map(([draw, months]) => {
            const drawKey = draw
            const drawSales = Array.from(months.values()).flatMap((weeks) => Array.from(weeks.values()).flatMap((days) => Array.from(days.values()).flat()))
            const drawOpen = expanded.has(drawKey)
            return <Fragment key={drawKey}>
              <TableRow className="cursor-pointer bg-muted/30 hover:bg-muted/50" onClick={() => toggle(drawKey)}>
                <TableCell colSpan={3} className="font-semibold"><div className="flex items-center gap-2"><ChevronRight className={`size-4 transition-transform ${drawOpen ? 'rotate-90' : ''}`} />{draw}</div></TableCell>
                <TableCell className="text-right font-mono tabular-nums">{drawSales.length} ventas</TableCell>
              </TableRow>
              {drawOpen && Array.from(months.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([month, weeks]) => {
                const key = `${draw}/${month}`
                const monthSales = Array.from(weeks.values()).flatMap((days) => Array.from(days.values()).flat())
                const monthOpen = expanded.has(key)
                return <Fragment key={key}>
                  <TableRow className="cursor-pointer bg-muted/20 hover:bg-muted/40" onClick={() => toggle(key)}>
                    <TableCell colSpan={3} className="pl-8 font-semibold capitalize"><div className="flex items-center gap-2"><ChevronRight className={`size-4 transition-transform ${monthOpen ? 'rotate-90' : ''}`} />{monthLabel(month)}</div></TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{monthSales.length} ventas</TableCell>
                  </TableRow>
                  {monthOpen && Array.from(weeks.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([week, days]) => {
                    const weekKeyValue = `${key}/${week}`
                    const weekSales = Array.from(days.values()).flat()
                    const weekOpen = expanded.has(weekKeyValue)
                    return <Fragment key={weekKeyValue}>
                      <TableRow className="cursor-pointer bg-muted/10 hover:bg-muted/30" onClick={() => toggle(weekKeyValue)}>
                        <TableCell colSpan={3} className="pl-14 font-semibold"><div className="flex items-center gap-2"><ChevronRight className={`size-4 transition-transform ${weekOpen ? 'rotate-90' : ''}`} />{weekLabel(week)}</div></TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{weekSales.length} ventas</TableCell>
                      </TableRow>
                      {weekOpen && Array.from(days.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([day, daySales]) => {
                        const dayKeyValue = `${weekKeyValue}/${day}`
                        const dayOpen = expanded.has(dayKeyValue)
                        return <Fragment key={dayKeyValue}>
                          <TableRow className="cursor-pointer hover:bg-muted/30" onClick={() => toggle(dayKeyValue)}>
                            <TableCell colSpan={3} className="pl-20 font-semibold capitalize"><div className="flex items-center gap-2"><ChevronRight className={`size-4 transition-transform ${dayOpen ? 'rotate-90' : ''}`} />{dayLabel(day)}</div></TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{daySales.length} ventas</TableCell>
                          </TableRow>
                          {dayOpen && daySales.map((sale) => {
                            const date = formatFechaHora(sale.fecha)
                            return <TableRow key={sale.id}>
                              <TableCell className="pl-24 font-mono tabular-nums"><span>{date.fecha}</span><span className="ml-2 text-muted-foreground">{date.hora}</span></TableCell>
                              <TableCell className="font-mono font-semibold tabular-nums">{sale.numero}</TableCell>
                              <TableCell className="font-mono tabular-nums">{sale.serie}</TableCell>
                              <TableCell className="font-mono tabular-nums">{sale.fraccion}</TableCell>
                            </TableRow>
                          })}
                        </Fragment>
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
