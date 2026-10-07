'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Ticket } from '@/lib/record-data'
import { parseSelaeBarcode } from '@/lib/selae-barcode'
import { InventorySearch, type SearchMode } from './inventory-search'
import { InventoryStockTable } from './inventory-stock-table'

type Props = {
  tickets: Ticket[]
  /** Registra la venta en el servidor y devuelve los identificadores de las ventas creadas. */
  onSale: (ids: string[]) => Promise<string[]>
  /** Anula en el servidor las ventas indicadas. */
  onUndoSale: (saleIds: string[]) => Promise<void>
}

type LastSale = { ids: string[]; saleIds: string[]; at: number }

export function InventoryTab({ tickets, onSale, onUndoSale }: Props) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('termina')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [lastSale, setLastSale] = useState<LastSale | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    let list = tickets
    if (onlyAvailable) list = list.filter((t) => !t.vendido && !t.cedido)
    if (query) {
      let barcode: ReturnType<typeof parseSelaeBarcode> | null = null
      try {
        barcode = parseSelaeBarcode(query)
      } catch {
        // La búsqueda manual por número sigue usando el modo seleccionado.
      }
      list = barcode
        ? list.filter((t) => t.numero === barcode?.numeroJugado && t.serie === barcode?.serie && t.fraccion === barcode?.fraccion)
        : list.filter((t) => (mode === 'termina' ? t.numero.endsWith(query) : t.numero.includes(query)))
    }
    return list
  }, [tickets, query, mode, onlyAvailable])

  const matchedNumeros = useMemo(() => {
    if (!query) return undefined
    return Array.from(new Set(filtered.map((t) => t.numero)))
  }, [filtered, query])

  // Autodespliega cuando la búsqueda deja pocos números (lectura de escáner)
  const autoExpand = matchedNumeros && matchedNumeros.length <= 3 ? matchedNumeros : undefined

  useEffect(() => {
    if (!lastSale) return
    const t = setTimeout(() => setLastSale(null), 6000)
    return () => clearTimeout(t)
  }, [lastSale])

  async function sell(ids: string[]) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const saleIds = await onSale(ids)
      setLastSale({ ids, saleIds, at: Date.now() })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo registrar la venta')
    } finally {
      setBusy(false)
    }
  }

  async function undo() {
    if (!lastSale || busy) return
    setBusy(true)
    setError('')
    try {
      await onUndoSale(lastSale.saleIds)
      setLastSale(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo deshacer la venta')
    } finally {
      setBusy(false)
    }
  }

  const saleSummary = useMemo(() => {
    if (!lastSale) return null
    const byNumero = new Map<string, number>()
    for (const id of lastSale.ids) {
      const numero = id.split('/')[0]
      byNumero.set(numero, (byNumero.get(numero) ?? 0) + 1)
    }
    return Array.from(byNumero.entries())
      .map(([n, c]) => `${c} × ${n}`)
      .join(' · ')
  }, [lastSale])

  return (
    <div className="flex flex-col gap-5">
      <InventorySearch
        query={query}
        onQueryChange={setQuery}
        mode={mode}
        onModeChange={setMode}
        onlyAvailable={onlyAvailable}
        onOnlyAvailableChange={setOnlyAvailable}
        resultCount={new Set(filtered.map((t) => t.numero)).size}
      />

      <div role="status" aria-live="polite" className={lastSale ? '' : 'hidden'}>
        {lastSale && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 aria-hidden="true" className="size-6 text-primary" />
              <div className="flex flex-col">
                <span className="font-semibold">
                  Venta registrada: {lastSale.ids.length} décimo{lastSale.ids.length !== 1 && 's'}
                </span>
                <span className="font-mono text-sm tabular-nums text-muted-foreground">{saleSummary}</span>
              </div>
            </div>
            <Button variant="outline" className="h-10 gap-2" disabled={busy} onClick={() => void undo()}>
              <Undo2 className="size-4" aria-hidden="true" />
              Deshacer
            </Button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <InventoryStockTable tickets={filtered} autoExpand={autoExpand} onSell={sell} />
    </div>
  )
}
