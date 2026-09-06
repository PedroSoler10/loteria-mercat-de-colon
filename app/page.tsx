'use client'

import { useState } from 'react'
import { AppHeader, type Tab } from '@/components/app-header'
import { RecordTab } from '@/components/record/record-tab'
import { InventoryTab } from '@/components/inventory/inventory-tab'
import { TpvTab } from '@/components/tpv/tpv-tab'
import { GraphicsTab } from '@/components/graphics-tab'
import { tickets as initialTickets, ticketId, type Ticket } from '@/lib/record-data'
import { initialSales, saleFromTicket, type Sale } from '@/lib/tpv-data'

export default function Page() {
  const [tab, setTab] = useState<Tab>('Inventario')
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets)
  const [sales, setSales] = useState<Sale[]>(initialSales)

  function registerSale(ids: string[]) {
    const selected = new Set(ids)
    const newSales = tickets
      .filter((ticket) => selected.has(ticketId(ticket)))
      .map((ticket) => saleFromTicket(ticket))
    setSales((current) => [...newSales, ...current])
  }

  function editSale(id: string, patch: Pick<Sale, 'fecha' | 'precio' | 'numero' | 'serie' | 'fraccion'>) {
    const currentSale = sales.find((sale) => sale.id === id)
    if (!currentSale) return false
    const previousTicketId = ticketId(currentSale)
    const nextTicketId = `${patch.numero}/${patch.serie}/${patch.fraccion}`
    const targetTicket = tickets.find((ticket) => ticketId(ticket) === nextTicketId)
    if (!targetTicket || (targetTicket.vendido && nextTicketId !== previousTicketId)) return false

    setSales((current) => current.map((sale) => (sale.id === id ? { ...sale, ...patch } : sale)))
    setTickets((current) =>
      current.map((ticket) => {
        const currentTicketId = ticketId(ticket)
        if (currentTicketId === previousTicketId) return { ...ticket, vendido: false }
        if (currentTicketId === nextTicketId) return { ...ticket, vendido: true }
        return ticket
      }),
    )
    return true
  }

  function voidSale(sale: Sale) {
    if (!window.confirm(`¿Anular la venta del número ${sale.numero}? El décimo volverá al stock.`)) return
    setSales((current) => current.filter((item) => item.id !== sale.id))
    setTickets((current) =>
      current.map((ticket) =>
        ticketId(ticket) === `${sale.numero}/${sale.serie}/${sale.fraccion}` ? { ...ticket, vendido: false } : ticket,
      ),
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader active={tab} onChange={setTab} />
      <main id={`panel-${tab}`} role="tabpanel" className="flex-1 px-6 py-6">
        {tab === 'Registro' && <RecordTab />}
        {tab === 'Inventario' && <InventoryTab tickets={tickets} onTicketsChange={setTickets} onSale={registerSale} />}
        {tab === 'TPV' && (
          <TpvTab
            tickets={tickets}
            sales={sales}
            onTicketsChange={setTickets}
            onSale={registerSale}
            onEdit={editSale}
            onVoid={voidSale}
          />
        )}
        {tab === 'Gráficas' && <GraphicsTab tickets={tickets} sales={sales} />}
      </main>
    </div>
  )
}
