'use client'

import { useEffect, useState } from 'react'
import { AppHeader, type Tab } from '@/components/app-header'
import { RecordTab } from '@/components/record/record-tab'
import { InventoryTab } from '@/components/inventory/inventory-tab'
import { TpvTab } from '@/components/tpv/tpv-tab'
import { AnalysisTab } from '@/components/analysis-tab'
import type { Albaran, Ticket } from '@/lib/record-data'
import type { Sale } from '@/lib/tpv-data'

export default function Page() {
  const [tab, setTab] = useState<Tab>('Inventario')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [albaranes, setAlbaranes] = useState<Albaran[]>([])

  async function refreshData() {
    const [inventoryResponse, salesResponse, originsResponse] = await Promise.all([
      fetch('/api/inventory', { cache: 'no-store' }),
      fetch('/api/sales', { cache: 'no-store' }),
      fetch('/api/origins', { cache: 'no-store' }),
    ])
    const failedResponse = [
      ['/api/inventory', inventoryResponse] as const,
      ['/api/sales', salesResponse] as const,
      ['/api/origins', originsResponse] as const,
    ].find(([, response]) => !response.ok)
    if (failedResponse) {
      const [endpoint, response] = failedResponse
      let detail = `${response.status} ${response.statusText}`.trim()
      try {
        const body = (await response.clone().json()) as { error?: string }
        if (body.error) detail = body.error
      } catch {
        // Keep the HTTP status when the server did not return JSON.
      }
      throw new Error(`No se pudo cargar ${endpoint}: ${detail}`)
    }
    setTickets(await inventoryResponse.json())
    setSales(await salesResponse.json())
    setAlbaranes(await originsResponse.json())
  }

  useEffect(() => {
    refreshData().catch((error) => console.error(error))
  }, [])

  async function registerSale(ids: string[]) {
    const response = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketIds: ids }),
    })
    if (!response.ok) throw new Error((await response.json()).error ?? 'No se pudo registrar la venta')
    await refreshData()
  }

  async function updateOrigin(idOrigen: string, patch: Partial<Pick<Albaran, 'idOrigen' | 'nombre' | 'tipoOrigen' | 'fechaCarga' | 'pdfPath' | 'pdfChecksum'>>) {
    const response = await fetch(`/api/origins/${encodeURIComponent(idOrigen)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) return (await response.json()).error ?? 'No se pudo modificar la carga'
    await refreshData()
    return undefined
  }

  async function deleteOrigin(idOrigen: string, deleteSales = false) {
    const response = await fetch(`/api/origins/${encodeURIComponent(idOrigen)}${deleteSales ? '?deleteSales=true' : ''}`, { method: 'DELETE' })
    const result = await response.json()
    if (!response.ok) return { error: result.error ?? 'No se pudo eliminar la carga', salesCount: result.salesCount as number | undefined }
    await refreshData()
    return { error: undefined, salesCount: undefined }
  }

  async function editSale(id: string, patch: Pick<Sale, 'fecha' | 'precio' | 'numero' | 'serie' | 'fraccion'>) {
    const response = await fetch(`/api/sales/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) return false
    await refreshData()
    return true
  }

  async function voidSale(sale: Sale) {
    if (!window.confirm(`¿Anular la venta del número ${sale.numero}? El décimo volverá al stock.`)) return
    const response = await fetch(`/api/sales/${encodeURIComponent(sale.id)}`, { method: 'DELETE' })
    if (!response.ok) return
    await refreshData()
  }

  async function restoreSale(sale: Sale) {
    const response = await fetch(`/api/sales/${encodeURIComponent(sale.id)}/restore`, { method: 'POST' })
    if (!response.ok) {
      window.alert((await response.json()).error ?? 'No se pudo revertir la venta')
      return
    }
    await refreshData()
  }

  async function permanentlyDeleteSale(sale: Sale) {
    if (!window.confirm(`¿Borrar definitivamente la venta anulada del número ${sale.numero}? Esta acción no se puede deshacer.`)) return
    const response = await fetch(`/api/sales/${encodeURIComponent(sale.id)}/permanent`, { method: 'DELETE' })
    if (!response.ok) {
      window.alert((await response.json()).error ?? 'No se pudo borrar definitivamente la venta')
      return
    }
    await refreshData()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader active={tab} onChange={setTab} />
      <main id={`panel-${tab}`} role="tabpanel" className="flex-1 px-6 py-6">
        {tab === 'Registro' && (
          <RecordTab
            albaranes={albaranes}
            onManualEntry={refreshData}
            onUpdate={updateOrigin}
            onDelete={deleteOrigin}
            onImported={refreshData}
          />
        )}
        {tab === 'Inventario' && <InventoryTab tickets={tickets} onTicketsChange={setTickets} onSale={registerSale} />}
        {tab === 'TPV' && (
          <TpvTab
            tickets={tickets}
            sales={sales}
            onTicketsChange={setTickets}
            onSale={registerSale}
            onEdit={editSale}
            onVoid={voidSale}
            onRestore={restoreSale}
            onDelete={permanentlyDeleteSale}
          />
        )}
        {tab === 'Análisis' && <AnalysisTab tickets={tickets} sales={sales} />}
      </main>
    </div>
  )
}
