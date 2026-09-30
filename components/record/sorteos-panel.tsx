'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Sorteo = {
  idSorteo: string
  tipoJuego: number
  nombreJuego: string
  anoCompleto: number
  numeroSorteo: number
  nombre: string
  precioCentimos: number
  boletos: number
  ventas: number
}
type SorteosResponse = { juegos: Record<string, string>; sorteos: Sorteo[] }
type Draft = { tipoJuego: string; nombreJuego: string; anoCompleto: string; numeroSorteo: string; nombre: string; precio: string }

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring'

function precioACentimos(value: string) {
  const number = Number(value.trim().replace(',', '.'))
  return Number.isFinite(number) ? Math.round(number * 100) : NaN
}

export function SorteosPanel({ refreshKey }: { refreshKey?: unknown }) {
  const [data, setData] = useState<SorteosResponse | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Sorteo | 'nuevo' | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [priceWarning, setPriceWarning] = useState<{ ventas: number } | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/sorteos', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'No se pudieron cargar los sorteos')
      setData(result)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los sorteos')
    }
  }, [])

  useEffect(() => { void load() }, [load, refreshKey])

  function startCreating() {
    const first = Object.keys(data?.juegos ?? {})[0] ?? '5'
    setDialogError('')
    setEditing('nuevo')
    setDraft({ tipoJuego: first, nombreJuego: data?.juegos[first] ?? '', anoCompleto: String(new Date().getFullYear()), numeroSorteo: '', nombre: '', precio: '20,00' })
  }

  function startEditing(sorteo: Sorteo) {
    setDialogError('')
    setEditing(sorteo)
    setDraft({ tipoJuego: String(sorteo.tipoJuego), nombreJuego: sorteo.nombreJuego, anoCompleto: String(sorteo.anoCompleto), numeroSorteo: String(sorteo.numeroSorteo), nombre: sorteo.nombre, precio: (sorteo.precioCentimos / 100).toFixed(2).replace('.', ',') })
  }

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current)
  }

  async function save(confirmarPrecio = false) {
    if (!editing || !draft) return
    const precioCentimos = precioACentimos(draft.precio)
    if (!Number.isInteger(precioCentimos) || precioCentimos <= 0) { setDialogError('El precio no es válido'); return }
    setSaving(true); setDialogError('')
    try {
      const isNew = editing === 'nuevo'
      const response = await fetch(isNew ? '/api/sorteos' : `/api/sorteos/${encodeURIComponent(editing.idSorteo)}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew
          ? { tipoJuego: draft.tipoJuego, anoCompleto: draft.anoCompleto, numeroSorteo: draft.numeroSorteo, nombre: draft.nombre, precioCentimos }
          : { nombre: draft.nombre, precioCentimos, confirmarPrecio }),
      })
      const result = await response.json()
      if (response.status === 409 && result.requiereConfirmacion) { setPriceWarning({ ventas: result.ventas }); return }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo guardar el sorteo')
      setEditing(null)
      await load()
    } catch (reason) {
      setDialogError(reason instanceof Error ? reason.message : 'No se pudo guardar el sorteo')
    } finally {
      setSaving(false)
    }
  }

  const isNew = editing === 'nuevo'
  return <section aria-labelledby="sorteos-title" className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div className="flex items-baseline gap-3"><h2 id="sorteos-title" className="text-lg font-semibold">Sorteos</h2><span className="text-sm text-muted-foreground">{data?.sorteos.length ?? 0} configurados</span></div>
      <Button variant="outline" className="h-10" onClick={startCreating} disabled={!data}><Plus /> Nuevo sorteo</Button>
    </div>
    <p className="text-sm text-muted-foreground">Se guardan en el archivo <span className="font-mono">sorteos.json</span>. Un albarán con un sorteo que no esté aquí lo añade automáticamente con el precio por defecto, que puedes corregir después.</p>
    <div className="overflow-x-auto rounded-md border"><Table className="table-auto"><TableHeader><TableRow className="bg-muted/60 hover:bg-muted/60"><TableHead>Juego</TableHead><TableHead>Año</TableHead><TableHead>Número</TableHead><TableHead>Nombre del sorteo</TableHead><TableHead className="text-right">Precio</TableHead><TableHead className="text-right">Boletos</TableHead><TableHead className="text-right">Ventas</TableHead><TableHead className="text-center">Acciones</TableHead></TableRow></TableHeader><TableBody>
      {data && data.sorteos.length === 0 && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Sin sorteos configurados.</TableCell></TableRow>}
      {data?.sorteos.map((sorteo) => <TableRow key={sorteo.idSorteo}><TableCell>{sorteo.tipoJuego} · {sorteo.nombreJuego}</TableCell><TableCell className="font-mono tabular-nums">{sorteo.anoCompleto}</TableCell><TableCell className="font-mono tabular-nums">{sorteo.numeroSorteo}</TableCell><TableCell>{sorteo.nombre}</TableCell><TableCell className="text-right font-mono tabular-nums">{euros.format(sorteo.precioCentimos / 100)}</TableCell><TableCell className="text-right font-mono tabular-nums">{sorteo.boletos}</TableCell><TableCell className="text-right font-mono tabular-nums">{sorteo.ventas}</TableCell><TableCell className="text-center"><Button type="button" variant="ghost" size="icon-sm" title="Modificar sorteo" aria-label={`Modificar ${sorteo.nombre}`} onClick={() => startEditing(sorteo)}><Pencil /></Button></TableCell></TableRow>)}
    </TableBody></Table></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open && !saving) setEditing(null) }}><DialogContent className="sm:max-w-xl" showCloseButton={!saving}><DialogHeader><DialogTitle>{isNew ? 'Nuevo sorteo' : 'Modificar sorteo'}</DialogTitle><DialogDescription>{isNew ? 'El juego, el año y el número identifican el sorteo y no se podrán cambiar después.' : 'Solo se pueden cambiar el nombre y el precio.'}</DialogDescription></DialogHeader>{draft && <div className="grid gap-3 sm:grid-cols-3">
      <div><Label htmlFor="sorteo-juego">Juego</Label>{isNew ? <select id="sorteo-juego" className={selectClass} value={draft.tipoJuego} onChange={(event) => updateDraft('tipoJuego', event.target.value)}>{Object.entries(data?.juegos ?? {}).map(([numero, nombre]) => <option key={numero} value={numero}>{numero} · {nombre}</option>)}</select> : <Input id="sorteo-juego" value={`${draft.tipoJuego} · ${draft.nombreJuego}`} disabled />}</div>
      <div><Label htmlFor="sorteo-anio">Año</Label><Input id="sorteo-anio" inputMode="numeric" maxLength={4} value={draft.anoCompleto} disabled={!isNew} onChange={(event) => updateDraft('anoCompleto', event.target.value.replace(/\D/g, ''))} /></div>
      <div><Label htmlFor="sorteo-numero">Número de sorteo</Label><Input id="sorteo-numero" inputMode="numeric" maxLength={3} value={draft.numeroSorteo} disabled={!isNew} onChange={(event) => updateDraft('numeroSorteo', event.target.value.replace(/\D/g, ''))} /></div>
      <div className="sm:col-span-2"><Label htmlFor="sorteo-nombre">Nombre</Label><Input id="sorteo-nombre" value={draft.nombre} maxLength={150} onChange={(event) => updateDraft('nombre', event.target.value)} /></div>
      <div><Label htmlFor="sorteo-precio">Precio del décimo (€)</Label><Input id="sorteo-precio" inputMode="decimal" value={draft.precio} onChange={(event) => updateDraft('precio', event.target.value.replace(/[^\d.,]/g, ''))} /></div>
    </div>}{dialogError && <p role="alert" className="text-sm text-destructive">{dialogError}</p>}<DialogFooter><Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={Boolean(priceWarning)} onOpenChange={(open) => { if (!open) { setPriceWarning(null); setSaving(false) } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Este sorteo ya tiene ventas</AlertDialogTitle><AlertDialogDescription>{priceWarning && `Tiene ${priceWarning.ventas} venta${priceWarning.ventas === 1 ? '' : 's'}. Cambiar el precio modificará los ingresos de todas ellas, también las ya realizadas. ¿Quieres continuar?`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { setPriceWarning(null); void save(true) }}>Cambiar precio</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>
}
