'use client'

import { useState } from 'react'
import { EditSalesGroupDialog, type GroupEditResult, type GroupPatch } from './edit-sales-group-dialog'
import { TpvHistoryTable } from './tpv-history-table'
import { TpvSaleSearch, type SaleMode, type ScanResult } from './tpv-sale-search'
import { TpvDayTable } from './tpv-day-table'
import { ticketId, type Ticket } from '@/lib/record-data'
import { parseSelaeBarcode } from '@/lib/selae-barcode'
import type { Sale } from '@/lib/tpv-data'

type Props = {
  tickets: Ticket[]
  sales: Sale[]
  onSale: (ids: string[], scan?: string) => Promise<unknown>

  onEditGroup: (ids: string[], patch: GroupPatch, overwrite: boolean) => Promise<GroupEditResult>
  onVoidMany: (sales: Sale[]) => void
  onRestoreMany: (sales: Sale[]) => void
  onDeleteMany: (sales: Sale[]) => void
}

export function TpvTab({ tickets, sales, onSale, onEditGroup, onVoidMany, onRestoreMany, onDeleteMany }: Props) {
  const [groupToEdit, setGroupToEdit] = useState<Sale[] | null>(null)
  const [saleMode, setSaleMode] = useState<SaleMode>('fraccion')

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

  async function sellScanned(code: string, mode: SaleMode): Promise<ScanResult> {
    let barcode: ReturnType<typeof parseSelaeBarcode> | null = null
    try {
      barcode = parseSelaeBarcode(code)
    } catch {
      // Sin código de barras válido solo se busca entre los boletos disponibles.
    }
    const selected = findAvailableTickets(code, mode)
    try {
      if (selected.length > 0) {
        // El código escaneado permite actualizar los dígitos de control de la fracción leída.
        await onSale(selected.map(ticketId), barcode ? code : undefined)
        return { sold: selected.length }
      }
      if (!barcode) return { sold: 0, message: 'Código no disponible' }

      const known = tickets.find((ticket) => ticket.numero === barcode.numeroJugado && ticket.serie === barcode.serie && ticket.fraccion === barcode.fraccion)
      if (known?.cedido) return { sold: 0, message: 'El boleto está cedido y no se puede vender' }
      if (known?.vendido) return { sold: 0, message: 'El boleto ya está vendido' }
      if (known) return { sold: 0, message: 'Código no disponible' }

      // El boleto no está en el inventario porque su albarán aún no se ha cargado: se vende y se recibirá después.
      // En modo serie se venden las 10 fracciones habituales (salvo las que ya existan en el inventario).
      const existentes = new Set(tickets.filter((ticket) => ticket.numero === barcode.numeroJugado && ticket.serie === barcode.serie).map((ticket) => ticket.fraccion))
      const fracciones = mode === 'serie'
        ? Array.from({ length: 10 }, (_, index) => String(index + 1).padStart(2, '0')).filter((fraccion) => !existentes.has(fraccion))
        : [barcode.fraccion]
      await onSale(fracciones.map((fraccion) => `${barcode.numeroJugado}/${barcode.serie}/${fraccion}`), code)
      return { sold: fracciones.length, message: `${fracciones.length} ${fracciones.length === 1 ? 'fracción vendida' : 'fracciones vendidas'} (albarán sin cargar)` }
    } catch (error) {
      return { sold: 0, message: error instanceof Error ? error.message : 'No se pudo registrar la venta' }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <TpvSaleSearch mode={saleMode} onModeChange={setSaleMode} onScan={sellScanned} />
      <TpvDayTable
        sales={sales}
        onEdit={setGroupToEdit}
        onVoid={onVoidMany}
        onRestore={onRestoreMany}
        onDelete={onDeleteMany}
      />
      <TpvHistoryTable
        sales={sales}
        onEdit={setGroupToEdit}
        onVoid={onVoidMany}
        onRestore={onRestoreMany}
        onDelete={onDeleteMany}
      />
      <EditSalesGroupDialog sales={groupToEdit} onClose={() => setGroupToEdit(null)} onSave={onEditGroup} />
    </div>
  )
}