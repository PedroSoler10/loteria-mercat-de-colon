'use client'

import { useState } from 'react'
import { AppHeader, type Tab } from '@/components/app-header'
import { InventoryTab } from '@/components/inventory/inventory-tab'
import { TpvTab } from '@/components/tpv/tpv-tab'
import { SalesTab } from '@/components/sales/sales-tab'
import { PlaceholderTab } from '@/components/placeholder-tab'
import { tickets as initialTickets, ticketId, type Ticket } from '@/lib/inventory-data'
import { initialSales, saleFromTicket, type Sale } from '@/lib/sales-data'

export default function Page() {
  const [tab, setTab] = useState<Tab>('TPV')
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets)
  const [sales, setSales] = useState<Sale[]>(initialSales)

  function registerSale(ids: string[]) {
    const selected = new Set(ids)
    const newSales = tickets
      .filter((ticket) => selected.has(ticketId(ticket)))
      .map((ticket) => saleFromTicket(ticket))
    setSales((current) => [...newSales, ...current])
  }

  function editSale(id: string, patch: Pick<Sale, 'fecha' | 'precio'>) {
    setSales((current) => current.map((sale) => (sale.id === id ? { ...sale, ...patch } : sale)))
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
        {tab === 'Inventario' && <InventoryTab tickets={tickets} />}
        {tab === 'TPV' && <TpvTab tickets={tickets} onTicketsChange={setTickets} onSale={registerSale} />}
        {tab === 'Registro de Ventas' && (
          <SalesTab sales={sales} onEdit={editSale} onVoid={voidSale} />
        )}
        {tab === 'Gráficas' && (
          <PlaceholderTab
            title="Gráficas"
            description="Evolución del inventario y de las ventas por sorteo, número y periodo."
          />
        )}
      </main>
    </div>
  )
}
