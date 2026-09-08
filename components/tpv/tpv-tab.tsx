'use client'

import { useMemo, useState } from 'react'
import { EditSaleDialog } from './edit-sale-dialog'
import { TpvSaleSearch, type SaleMode } from './tpv-sale-search'
import { TpvTable } from './tpv-table'
import { CedidoTable } from './cedido-table'
import { ticketId, type Ticket } from '@/lib/record-data'
import { parseSelaeBarcode } from '@/lib/selae-barcode'
import { filterByPeriodo, type Periodo, type Sale } from '@/lib/tpv-data'

type Props = {
  tickets: Ticket[]
  sales: Sale[]
  onTicketsChange: (next: Ticket[]) => void
  onSale: (ids: string[]) => void
  onEdit: (id: string, patch: Pick<Sale, 'fecha' | 'precio' | 'numero' | 'serie' | 'fraccion'>) => boolean | Promise<boolean>
  onVoid: (sale: Sale) => void
  onRestore: (sale: Sale) => void
  onDelete: (sale: Sale) => void
  cedidos: Sale[]
}

export function TpvTab({ tickets, sales, onTicketsChange, onSale, onEdit, onVoid, onRestore, onDelete, cedidos }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null)
  const [saleMode, setSaleMode] = useState<SaleMode>('fraccion')

  const periodSales = useMemo(() => filterByPeriodo(sales, periodo), [sales, periodo])
  function findAvailableTickets(code: string, mode: SaleMode) {
    const normalized = code.trim().replace(/[ -]/g, '/')
    const parts = normalized.split('/').filter(Boolean)
    const available = tickets.filter((ticket) => !ticket.vendido && !ticket.cedido)
    let barcode: ReturnType<typeof parseSelaeBarcode> | null = null
    try {
      barcode = parseSelaeBarcode(code)
    } catch {
      // También se admiten búsquedas manuales por número, serie y fracción.
    }

    if (barcode) {
      const matching = available.filter((ticket) =>
        ticket.numero === barcode.numeroJugado && ticket.serie === barcode.serie,
      )
      if (mode === 'fraccion') {
        return matching.filter((ticket) => ticket.fraccion === barcode?.fraccion)
      }
      return matching
    }

    if (mode === 'fraccion') {
      const exact = available.find((ticket) =>
        ticketId(ticket) === normalized || `${ticket.numero}${ticket.serie}${ticket.fraccion}` === normalized,
      )
      if (exact) return [exact]
      if (parts.length >= 2) {
        const seriesTicket = available.find((ticket) => `${ticket.numero}/${ticket.serie}` === `${parts[0]}/${parts[1]}`)
        if (seriesTicket) return [seriesTicket]
      }
      return available.filter((ticket) => ticket.numero === normalized).slice(0, 1)
    }

    if (parts.length >= 2) {
      return available.filter((ticket) => `${ticket.numero}/${ticket.serie}` === `${parts[0]}/${parts[1]}`)
    }
    const exactSeries = available.filter((ticket) => `${ticket.numero}${ticket.serie}` === normalized)
    return exactSeries.length > 0 ? exactSeries : available.filter((ticket) => ticket.numero === normalized)
  }

  function sellScanned(code: string, mode: SaleMode) {
    const selected = findAvailableTickets(code, mode)
    if (selected.length === 0) return 0
    const ids = selected.map(ticketId)
    onSale(ids)
    const selectedIds = new Set(ids)
    onTicketsChange(tickets.map((ticket) => (selectedIds.has(ticketId(ticket)) ? { ...ticket, vendido: true } : ticket)))
    return ids.length
  }

  return (
    <div className="flex flex-col gap-5">
      <TpvSaleSearch mode={saleMode} onModeChange={setSaleMode} onScan={sellScanned} />
      <TpvTable sales={periodSales} onEdit={setSaleToEdit} onVoid={onVoid} onRestore={onRestore} onDelete={onDelete} />
      <CedidoTable cedidos={cedidos} />
      <EditSaleDialog sale={saleToEdit} onClose={() => setSaleToEdit(null)} onSave={onEdit} />
    </div>
  )
}