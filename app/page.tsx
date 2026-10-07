'use client'

import { useEffect, useState } from 'react'
import { AppHeader, type Tab } from '@/components/app-header'
import { RecordTab } from '@/components/record/record-tab'
import { InventoryTab } from '@/components/inventory/inventory-tab'
import { TpvTab } from '@/components/tpv/tpv-tab'
import { AnalysisTab } from '@/components/analysis-tab'
import { DatabaseSetup } from '@/components/database-setup'
import type { Albaran, Cedido, Ticket } from '@/lib/record-data'
import type { GroupConflict, GroupEditResult, GroupPatch } from '@/components/tpv/edit-sales-group-dialog'
import { formatFracciones, formatSeries, type Sale } from '@/lib/tpv-data'

export default function Page() {
  const [tab, setTab] = useState<Tab>('TPV')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [cedidos, setCedidos] = useState<Cedido[]>([])
  const [albaranes, setAlbaranes] = useState<Albaran[]>([])
  const [databaseReady, setDatabaseReady] = useState<boolean | null>(null)
  const [databasePath, setDatabasePath] = useState('')

  async function refreshData() {
    const [inventoryResponse, salesResponse, cedidosResponse, originsResponse] = await Promise.all([
      fetch('/api/inventory', { cache: 'no-store' }),
      fetch('/api/sales', { cache: 'no-store' }),
      fetch('/api/cedidos', { cache: 'no-store' }),
      fetch('/api/origins', { cache: 'no-store' }),
    ])
    const failedResponse = [
      ['/api/inventory', inventoryResponse] as const,
      ['/api/sales', salesResponse] as const,
      ['/api/cedidos', cedidosResponse] as const,
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
    const cedidos = await cedidosResponse.json()
    setAlbaranes(await originsResponse.json())
    setCedidos(cedidos)
  }

  useEffect(() => {
    fetch('/api/database', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo comprobar la base de datos')
        const result = await response.json() as { configured?: boolean; path?: string }
        setDatabasePath(result.path ?? '')
        setDatabaseReady(result.configured === true)
        if (result.configured === true) await refreshData()
      })
      .catch((error) => console.error(error))
  }, [])

  async function completeDatabaseSetup() {
    const response = await fetch('/api/database', { cache: 'no-store' })
    const result = await response.json() as { path?: string }
    setDatabasePath(result.path ?? '')
    setDatabaseReady(true)
    await refreshData()
  }

  async function refreshDatabaseStatus() {
    const response = await fetch('/api/database', { cache: 'no-store' })
    if (!response.ok) throw new Error('No se pudo consultar la base de datos')
    const result = await response.json() as { path?: string }
    setDatabasePath(result.path ?? '')
    await refreshData()
  }

  if (databaseReady !== true) {
    if (databaseReady === null) return <div className="min-h-screen" />
    return <DatabaseSetup onReady={completeDatabaseSetup} />
  }

  // Devuelve los identificadores de las ventas creadas, por si hay que deshacerlas.
  async function registerSale(ids: string[], scan?: string) {
    const response = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketIds: ids, scan }),
    })
    if (!response.ok) throw new Error((await response.json()).error ?? 'No se pudo registrar la venta')
    const created = (await response.json()) as { id: string }[]
    await refreshData()
    return created.map((sale) => sale.id)
  }

  // Deshacer una venta recién hecha: se anula en el servidor (queda en el historial y se puede restaurar).
  async function undoSale(saleIds: string[]) {
    const errors: string[] = []
    for (const id of saleIds) {
      const response = await fetch(`/api/sales/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) errors.push((await response.json().catch(() => ({}))).error ?? 'No se pudo anular la venta')
    }
    await refreshData()
    if (errors.length > 0) throw new Error(errors[0])
  }

  async function updateOrigin(idOrigen: string, patch: Partial<Pick<Albaran, 'idOrigen' | 'tipoOrigen' | 'fechaCarga' | 'pdfPath' | 'pdfChecksum'>>) {
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

  // Acciones sobre un grupo de ventas (mismo número, serie y minuto): se aplican una a una y se refresca una sola vez.
  async function runOnGroup(sales: Sale[], request: (sale: Sale) => Promise<Response>, fallback: string) {
    const errors: string[] = []
    for (const sale of sales) {
      const response = await request(sale)
      if (!response.ok) errors.push(`Fracción ${Number(sale.fraccion)}: ${(await response.json().catch(() => ({}))).error ?? fallback}`)
    }
    await refreshData()
    if (errors.length > 0) window.alert(`${fallback}\n${errors.join('\n')}`)
  }

  function describeGroup(sales: Sale[]) {
    const fracciones = formatFracciones(sales.map((sale) => Number(sale.fraccion)))
    const series = formatSeries(sales.map((sale) => Number(sale.serie)))
    const variasSeries = new Set(sales.map((sale) => sale.serie)).size > 1
    return `${sales[0].numero}, ${variasSeries ? 'series' : 'serie'} ${series}, ${sales.length === 1 ? 'fracción' : 'fracciones'} ${fracciones} (${sales.length} ${sales.length === 1 ? 'venta' : 'ventas'})`
  }

  async function voidGroup(sales: Sale[]) {
    if (!window.confirm(`¿Anular las ventas de ${describeGroup(sales)}? Los décimos volverán al stock.`)) return
    await runOnGroup(sales, (sale) => fetch(`/api/sales/${encodeURIComponent(sale.id)}`, { method: 'DELETE' }), 'No se pudieron anular todas las ventas')
  }

  async function restoreGroup(sales: Sale[]) {
    await runOnGroup(sales, (sale) => fetch(`/api/sales/${encodeURIComponent(sale.id)}/restore`, { method: 'POST' }), 'No se pudieron recuperar todas las ventas')
  }

  async function permanentlyDeleteGroup(sales: Sale[]) {
    if (!window.confirm(`¿Borrar definitivamente las ventas anuladas de ${describeGroup(sales)}? Esta acción no se puede deshacer.`)) return
    await runOnGroup(sales, (sale) => fetch(`/api/sales/${encodeURIComponent(sale.id)}/permanent`, { method: 'DELETE' }), 'No se pudieron borrar definitivamente todas las ventas')
  }

  async function editGroup(ids: string[], patch: GroupPatch, overwrite: boolean): Promise<GroupEditResult> {
    const response = await fetch('/api/sales/grupo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, ...patch, overwrite }),
    })
    const result = await response.json().catch(() => ({})) as { error?: string; conflicts?: GroupConflict[] }
    if (!response.ok) return { ok: false, error: result.error ?? 'No se pudieron editar las ventas', conflicts: result.conflicts }
    await refreshData()
    return { ok: true }
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
            cedidos={cedidos}
            databasePath={databasePath}
            onDatabaseImported={refreshDatabaseStatus}
            sales={sales}
          />
        )}
        {tab === 'Inventario' && <InventoryTab tickets={tickets} onSale={registerSale} onUndoSale={undoSale} />}
        {tab === 'TPV' && (
          <TpvTab
            tickets={tickets}
            sales={sales}
            onSale={registerSale}
            onEditGroup={editGroup}
            onVoidMany={voidGroup}
            onRestoreMany={restoreGroup}
            onDeleteMany={permanentlyDeleteGroup}
          />
        )}
        {tab === 'Análisis' && <AnalysisTab tickets={tickets} sales={sales} cedidos={cedidos} />}
      </main>
    </div>
  )
}
