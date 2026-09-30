'use client'

import { ChevronRight } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import type { Sale } from '@/lib/tpv-data'
import { SaleRow, SaleRowsHeader, buildRows, type SaleGroup, type SaleGroupActions } from './tpv-sale-rows'

type Props = { sales: Sale[] } & SaleGroupActions

function dateKey(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthKey(date: Date) {
  return dateKey(date).slice(0, 7)
}

function weekKey(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return dateKey(start)
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
  return new Date(`${key}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

type Day = { key: string; rows: SaleGroup[]; count: number }
type Week = { key: string; days: Day[]; count: number }
type Month = { key: string; weeks: Week[]; count: number }

/** Mes > semana > día > filas agrupadas, del más reciente al más antiguo. */
function buildTree(sales: Sale[]): Month[] {
  const months = new Map<string, Map<string, Map<string, Sale[]>>>()
  for (const sale of sales) {
    const date = new Date(sale.fecha)
    const m = monthKey(date)
    const w = weekKey(date)
    const d = dateKey(date)
    if (!months.has(m)) months.set(m, new Map())
    if (!months.get(m)!.has(w)) months.get(m)!.set(w, new Map())
    if (!months.get(m)!.get(w)!.has(d)) months.get(m)!.get(w)!.set(d, [])
    months.get(m)!.get(w)!.get(d)!.push(sale)
  }
  const desc = ([a]: [string, unknown], [b]: [string, unknown]) => b.localeCompare(a)
  return Array.from(months.entries()).sort(desc).map(([month, weeks]) => {
    const weekList = Array.from(weeks.entries()).sort(desc).map(([week, days]) => {
      const dayList = Array.from(days.entries()).sort(desc).map(([day, daySales]) => ({
        key: day,
        rows: buildRows(daySales),
        count: daySales.length,
      }))
      return { key: week, days: dayList, count: dayList.reduce((total, day) => total + day.count, 0) }
    })
    return { key: month, weeks: weekList, count: weekList.reduce((total, week) => total + week.count, 0) }
  })
}

export function TpvHistoryTable({ sales, onEdit, onVoid, onRestore, onDelete }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const tree = useMemo(() => buildTree(sales), [sales])
  // Cada nivel lleva su prefijo: la semana que empieza en lunes y ese mismo día tendrían la misma clave.
  const allKeys = tree.flatMap((month) => [`mes|${month.key}`, ...month.weeks.flatMap((week) => [`semana|${week.key}`, ...week.days.map((day) => `dia|${day.key}`)])])
  const allExpanded = tree.length > 0 && allKeys.every((key) => expanded.has(key))

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function groupRow(label: string, key: string, count: number, indent: string, tone: string, open: boolean) {
    return (
      <TableRow className={`cursor-pointer ${tone}`} onClick={() => toggle(key)}>
        <TableCell colSpan={5} className={`${indent} font-semibold capitalize`}>
          <div className="flex items-center gap-2">
            <ChevronRight className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`} />
            {label}
          </div>
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums">{count} {count === 1 ? 'fracción' : 'fracciones'}</TableCell>
      </TableRow>
    )
  }

  return (
    <section aria-labelledby="historial-title" className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex flex-col">
          <h2 id="historial-title" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Historial transaccional
          </h2>
          <span className="text-sm text-foreground">
            {sales.length} {sales.length === 1 ? 'fracción vendida' : 'fracciones vendidas'} · orden cronológico descendente
          </span>
        </div>
        <Button type="button" variant="outline" onClick={() => setExpanded(allExpanded ? new Set() : new Set(allKeys))}>
          {allExpanded ? 'Contraer todo' : 'Expandir todo'}
        </Button>
      </div>

      <Table className="min-w-[720px] table-auto text-base">
        <SaleRowsHeader />
        <TableBody>
          {sales.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No hay ventas registradas.
              </TableCell>
            </TableRow>
          )}
          {tree.map((month) => (
            <Fragment key={month.key}>
              {groupRow(monthLabel(month.key), `mes|${month.key}`, month.count, '', 'bg-muted/30 hover:bg-muted/50', expanded.has(`mes|${month.key}`))}
              {expanded.has(`mes|${month.key}`) && month.weeks.map((week) => (
                <Fragment key={week.key}>
                  {groupRow(weekLabel(week.key), `semana|${week.key}`, week.count, 'pl-10', 'bg-muted/20 hover:bg-muted/40', expanded.has(`semana|${week.key}`))}
                  {expanded.has(`semana|${week.key}`) && week.days.map((day) => (
                    <Fragment key={day.key}>
                      {groupRow(dayLabel(day.key), `dia|${day.key}`, day.count, 'pl-20', 'bg-muted/10 hover:bg-muted/30', expanded.has(`dia|${day.key}`))}
                      {expanded.has(`dia|${day.key}`) && day.rows.map((group) => (
                        <SaleRow key={group.key} group={group} onEdit={onEdit} onVoid={onVoid} onRestore={onRestore} onDelete={onDelete} />
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
