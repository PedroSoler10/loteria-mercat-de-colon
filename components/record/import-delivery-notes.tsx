'use client'

import { Fragment, useMemo, useRef, useState } from 'react'
import { ChevronRight, FileText, FileUp, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { Albaran, Cedido } from '@/lib/record-data'
import { formatFechaHora, eur } from '@/lib/tpv-data'

type ImportProps = { onImported: () => Promise<void> }
type OriginPatch = Pick<Albaran, 'idOrigen' | 'nombre' | 'tipoOrigen' | 'fechaCarga' | 'pdfPath' | 'pdfChecksum'>
type DeleteResult = { error?: string; salesCount?: number }
type TableProps = { albaranes: Albaran[]; onUpdate: (id: string, patch: OriginPatch) => Promise<string | undefined>; onDelete: (id: string, deleteSales?: boolean) => Promise<DeleteResult> }

function Chevron({ open, className }: { open: boolean; className?: string }) {
  return <ChevronRight aria-hidden="true" className={cn('size-5 shrink-0 transition-transform duration-150', open && 'rotate-90', className)} />
}

export function CedidoRecordsTable({ cedidos }: { cedidos: Cedido[] }) {
  return <section aria-labelledby="cedidos-registro-title" className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm">
    <div className="flex items-baseline gap-3">
      <h2 id="cedidos-registro-title" className="text-lg font-semibold">Cedidos</h2>
      <span className="text-sm text-muted-foreground">{cedidos.length} registros</span>
    </div>
    <div className="overflow-x-auto rounded-md border">
      <Table className="min-w-[1100px] table-auto">
        <TableHeader><TableRow className="bg-muted/60 hover:bg-muted/60">
          <TableHead>Fecha y hora</TableHead><TableHead>Nombre del Sorteo</TableHead><TableHead>Albarán</TableHead>
          <TableHead>Número</TableHead><TableHead>Serie</TableHead><TableHead>Fracción</TableHead>
          <TableHead>Recibido</TableHead><TableHead className="text-right">Precio</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {cedidos.length === 0 && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Sin cesiones registradas.</TableCell></TableRow>}
          {cedidos.map((cedido) => {
            const { fecha, hora } = formatFechaHora(cedido.fecha)
            return <TableRow key={cedido.id}>
              <TableCell className="font-mono tabular-nums">{fecha} <span className="text-muted-foreground">{hora}</span></TableCell>
              <TableCell>{cedido.sorteo}</TableCell><TableCell className="font-mono">{cedido.idOrigen}</TableCell>
              <TableCell className="font-mono font-semibold">{cedido.numero}</TableCell><TableCell className="font-mono">{cedido.serie}</TableCell>
              <TableCell className="font-mono">{cedido.fraccion}</TableCell><TableCell>{cedido.idBoleto ? 'Sí' : 'No'}</TableCell>
              <TableCell className="text-right font-mono">{eur.format(cedido.precio)}</TableCell>
            </TableRow>
          })}
        </TableBody>
      </Table>
    </div>
  </section>
}

function ToggleLabel({ open, label, onClick, compact = false }: { open: boolean; label: string; onClick: () => void; compact?: boolean }) {
  return <button type="button" aria-expanded={open} onClick={(event) => { event.stopPropagation(); onClick() }} className={cn('flex items-center gap-2 rounded-md px-2 text-left hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring', compact ? 'h-9' : 'h-10 text-primary')}><Chevron open={open} className={compact ? 'size-4' : undefined} /><span>{label}</span></button>
}

type DrawGroup = { nombreSorteo: string; tipos: { tipoOrigen: string; origenes: Albaran[] }[] }
const COLS = 11

export function ImportDeliveryNotes({ onImported }: ImportProps) {
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState<File[]>([])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  function handleFiles(files: FileList | null) {
    if (!files) return
    const pdfs = Array.from(files).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length) setPending((current) => [...current, ...pdfs])
  }
  async function processPending() {
    if (!pending.length) return
    setProcessing(true); setError('')
    try {
      for (const file of pending) {
        const formData = new FormData(); formData.append('file', file)
        const response = await fetch('/api/delivery-notes', { method: 'POST', body: formData })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? `No se pudo procesar ${file.name}`)
      }
      setPending([]); await onImported()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo procesar el albarán') } finally { setProcessing(false) }
  }
  return <section aria-labelledby="import-title" className="flex h-full flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm">
    <div className="flex items-center justify-between"><h2 id="import-title" className="text-lg font-semibold">Importar albaranes</h2><span className="text-sm text-muted-foreground">PDF</span></div>
    <div role="button" tabIndex={0} aria-label="Zona para soltar albaranes PDF" onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inputRef.current?.click() } }} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); handleFiles(event.dataTransfer.files) }} className={cn('flex min-h-36 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-8 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', dragging ? 'border-accent bg-accent/10' : 'border-input bg-muted/40 hover:border-primary/40 hover:bg-muted')}>
      <FileUp className="size-8 text-primary" /><p className="text-base font-medium">Arrastra aquí los albaranes PDF</p><p className="text-sm text-muted-foreground">o haz clic para seleccionarlos</p><input ref={inputRef} type="file" accept="application/pdf" multiple className="sr-only" onChange={(event) => handleFiles(event.target.files)} />
    </div>
    {pending.length > 0 && <div className="flex flex-col gap-2 rounded-md border border-accent/50 bg-accent/10 p-3"><p className="text-sm font-medium text-accent-foreground">{pending.length} archivo{pending.length === 1 ? '' : 's'} pendiente{pending.length === 1 ? '' : 's'} de procesar</p><ul className="flex flex-col gap-1">{pending.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-sm"><FileText className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{file.name}</span></li>)}</ul><div className="flex gap-2"><Button size="lg" className="h-11 flex-1 text-base" disabled={processing} onClick={() => void processPending()}>{processing ? 'Procesando…' : 'Procesar'}</Button><Button size="lg" variant="outline" className="h-11 text-base" disabled={processing} onClick={() => setPending([])}>Descartar</Button></div></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>
}

export function ImportedDeliveryNotesTable({ albaranes, onUpdate, onDelete }: TableProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Albaran | null>(null)
  const [draft, setDraft] = useState<OriginPatch | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<Albaran | null>(null)
  const [deleteWithSales, setDeleteWithSales] = useState<{ origin: Albaran; salesCount: number } | null>(null)
  const [openDraws, setOpenDraws] = useState<Set<string>>(new Set())
  const [openTypes, setOpenTypes] = useState<Set<string>>(new Set())
  const [openOrigins, setOpenOrigins] = useState<Set<string>>(new Set())
  const [openNumbers, setOpenNumbers] = useState<Set<string>>(new Set())
  const [openSeries, setOpenSeries] = useState<Set<string>>(new Set())
  const draws = useMemo<DrawGroup[]>(() => {
    const byDraw = new Map<string, Map<string, Albaran[]>>()
    for (const origin of albaranes) {
      if (!byDraw.has(origin.nombreSorteo)) byDraw.set(origin.nombreSorteo, new Map())
      const byType = byDraw.get(origin.nombreSorteo)!
      if (!byType.has(origin.tipoOrigen)) byType.set(origin.tipoOrigen, [])
      byType.get(origin.tipoOrigen)!.push(origin)
    }

    return Array.from(byDraw.entries()).map(([nombreSorteo, byType]) => ({
      nombreSorteo,
      tipos: Array.from(byType.entries()).map(([tipoOrigen, origenes]) => ({ tipoOrigen, origenes })),
    }))
  }, [albaranes])
  function toggle(set: Set<string>, key: string, apply: (next: Set<string>) => void) { const next = new Set(set); next.has(key) ? next.delete(key) : next.add(key); apply(next) }
  function totals(origins: Albaran[]) { return origins.reduce((sum, origin) => ({ numeros: sum.numeros + origin.numerosDiferentes, series: sum.series + origin.totalSeries, billetes: sum.billetes + origin.totalBoletos }), { numeros: 0, series: 0, billetes: 0 }) }
  function expandAll() {
    setOpenDraws(new Set(draws.map((draw) => draw.nombreSorteo)))
    setOpenTypes(new Set(draws.flatMap((draw) => draw.tipos.map((type) => `${draw.nombreSorteo}/${type.tipoOrigen}`))))
    setOpenOrigins(new Set(albaranes.map((origin) => origin.idOrigen)))
    setOpenNumbers(new Set(albaranes.flatMap((origin) => origin.detalles?.map((detail) => `${origin.idOrigen}/${detail.numero}`) ?? [])))
    setOpenSeries(new Set(albaranes.flatMap((origin) => origin.detalles?.flatMap((detail) => detail.series.map((serie) => `${origin.idOrigen}/${detail.numero}/${serie.serie}`)) ?? [])))
  }

  function collapseAll() { setOpenDraws(new Set()); setOpenTypes(new Set()); setOpenOrigins(new Set()); setOpenNumbers(new Set()); setOpenSeries(new Set()) }
  function startEditing(origin: Albaran) { setError(''); setEditing(origin); setDraft({ idOrigen: origin.idOrigen, nombre: origin.nombre, tipoOrigen: origin.tipoOrigen, fechaCarga: origin.fechaCarga, pdfPath: origin.pdfPath, pdfChecksum: origin.pdfChecksum }) }
  function updateDraft<K extends keyof OriginPatch>(key: K, value: OriginPatch[K]) { setDraft((current) => current ? { ...current, [key]: value } : current) }
  async function save() { if (!editing || !draft) return; setBusyId(editing.idOrigen); const result = await onUpdate(editing.idOrigen, draft); if (result) setError(result); else setEditing(null); setBusyId(null) }
  async function remove(origin: Albaran, deleteSales = false) { setBusyId(origin.idOrigen); setError(''); const result = await onDelete(origin.idOrigen, deleteSales); if (result.salesCount) setDeleteWithSales({ origin, salesCount: result.salesCount }); else if (result.error) setError(result.error); setBusyId(null) }
  return <section aria-labelledby="imported-title" className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm">
    <div className="flex items-center justify-between"><div className="flex items-baseline gap-3"><h2 id="imported-title" className="text-lg font-semibold">Importaciones registradas</h2><span className="text-sm text-muted-foreground">{albaranes.length} importadas</span></div><div className="flex gap-2"><Button variant="outline" className="h-10" onClick={expandAll}>Desplegar todo</Button><Button variant="outline" className="h-10" onClick={collapseAll}>Contraer todo</Button></div></div>
    <div className="overflow-x-auto rounded-md border"><Table className="min-w-[1400px] table-auto"><TableHeader><TableRow className="bg-muted/60 hover:bg-muted/60"><TableHead>Nombre del Sorteo</TableHead><TableHead>Tipo de Origen</TableHead><TableHead>ID</TableHead><TableHead>Fecha de emisión</TableHead><TableHead className="text-right">Total Números</TableHead><TableHead>Números</TableHead><TableHead className="text-right">Total Series</TableHead><TableHead>Series</TableHead><TableHead className="text-right">Total Fracciones</TableHead><TableHead>Fracciones</TableHead><TableHead className="text-center">Acciones</TableHead></TableRow></TableHeader><TableBody>
      {draws.length === 0 && <TableRow><TableCell colSpan={COLS} className="h-24 text-center text-muted-foreground">Sin importaciones registradas.</TableCell></TableRow>}
      {draws.map((draw) => { const drawOpen = openDraws.has(draw.nombreSorteo); const drawOrigins = draw.tipos.flatMap((type) => type.origenes); const drawTotals = totals(drawOrigins); return <Fragment key={draw.nombreSorteo}>
        <TableRow className={cn('cursor-pointer bg-card', drawOpen && 'bg-primary/5 hover:bg-primary/5')} onClick={() => toggle(openDraws, draw.nombreSorteo, setOpenDraws)}><TableCell className="p-1 font-semibold"><ToggleLabel open={drawOpen} label={draw.nombreSorteo} onClick={() => toggle(openDraws, draw.nombreSorteo, setOpenDraws)} /></TableCell><TableCell className="text-muted-foreground">{draw.tipos.length} tipos</TableCell><TableCell className="text-muted-foreground">{drawOrigins.length} importaciones</TableCell><TableCell>—</TableCell><TableCell className="text-right font-mono tabular-nums">{drawTotals.numeros}</TableCell><TableCell>—</TableCell><TableCell className="text-right font-mono tabular-nums">{drawTotals.series}</TableCell><TableCell>—</TableCell><TableCell className="text-right font-mono tabular-nums">{drawTotals.billetes}</TableCell><TableCell>—</TableCell><TableCell /></TableRow>
        {drawOpen && draw.tipos.map((type) => { const typeKey = `${draw.nombreSorteo}/${type.tipoOrigen}`; const typeOpen = openTypes.has(typeKey); const typeTotals = totals(type.origenes); return <Fragment key={typeKey}>
          <TableRow className={cn('cursor-pointer bg-muted/30', typeOpen && 'bg-muted/60 hover:bg-muted/60')} onClick={() => toggle(openTypes, typeKey, setOpenTypes)}><TableCell><span className="ml-3 block border-l-2 border-primary/20 pl-4 text-sm text-muted-foreground">{draw.nombreSorteo}</span></TableCell><TableCell className="p-1 font-medium"><ToggleLabel compact open={typeOpen} label={type.tipoOrigen} onClick={() => toggle(openTypes, typeKey, setOpenTypes)} /></TableCell><TableCell className="text-muted-foreground">{type.origenes.length} importaciones</TableCell><TableCell>—</TableCell><TableCell className="text-right font-mono tabular-nums">{typeTotals.numeros}</TableCell><TableCell>—</TableCell><TableCell className="text-right font-mono tabular-nums">{typeTotals.series}</TableCell><TableCell>—</TableCell><TableCell className="text-right font-mono tabular-nums">{typeTotals.billetes}</TableCell><TableCell>—</TableCell><TableCell /></TableRow>
          {typeOpen && type.origenes.map((origin) => { const originOpen = openOrigins.has(origin.idOrigen); return <Fragment key={origin.idOrigen}>
            <TableRow className={cn('cursor-pointer bg-card', originOpen && 'bg-primary/5 hover:bg-primary/5')} onClick={() => toggle(openOrigins, origin.idOrigen, setOpenOrigins)}><TableCell><span className="ml-6 block border-l-2 border-primary/20 pl-4 text-sm text-muted-foreground">{draw.nombreSorteo}</span></TableCell><TableCell className="text-muted-foreground">{type.tipoOrigen}</TableCell><TableCell className="p-1"><ToggleLabel compact open={originOpen} label={origin.idOrigen} onClick={() => toggle(openOrigins, origin.idOrigen, setOpenOrigins)} /></TableCell><TableCell className="font-mono text-sm tabular-nums">{origin.fechaEmision ? new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC' }).format(new Date(origin.fechaEmision)) : '—'}</TableCell><TableCell className="text-right font-mono tabular-nums">{origin.numerosDiferentes}</TableCell><TableCell className="text-muted-foreground">{origin.detalles?.length ?? 0} números</TableCell><TableCell className="text-right font-mono tabular-nums">{origin.totalSeries}</TableCell><TableCell className="text-muted-foreground">—</TableCell><TableCell className="text-right font-mono tabular-nums">{origin.totalBoletos}</TableCell><TableCell className="text-muted-foreground">—</TableCell><TableCell className="text-center"><div className="flex justify-center gap-1"><Button type="button" variant="ghost" size="icon-sm" title="Modificar registro del albarán" aria-label={`Modificar ${origin.nombre}`} disabled={busyId !== null} onClick={(event) => { event.stopPropagation(); startEditing(origin) }}><Pencil /></Button><Button type="button" variant="ghost" size="icon-sm" title="Eliminar carga" aria-label={`Eliminar ${origin.nombre}`} disabled={busyId !== null} onClick={(event) => { event.stopPropagation(); setDeleteConfirmation(origin) }}><Trash2 /></Button></div></TableCell></TableRow>
            {originOpen && origin.detalles?.map((detail) => { const numberKey = `${origin.idOrigen}/${detail.numero}`; const numberOpen = openNumbers.has(numberKey); const numberBilletes = detail.series.reduce((total, serie) => total + serie.fracciones.length, 0); return <Fragment key={numberKey}>
              <TableRow className={cn('cursor-pointer bg-muted/20', numberOpen && 'bg-muted/40 hover:bg-muted/40')} onClick={() => toggle(openNumbers, numberKey, setOpenNumbers)}><TableCell /><TableCell /><TableCell /><TableCell /><TableCell className="text-right font-mono tabular-nums">1</TableCell><TableCell className="p-1"><ToggleLabel compact open={numberOpen} label={detail.numero} onClick={() => toggle(openNumbers, numberKey, setOpenNumbers)} /></TableCell><TableCell className="text-right font-mono tabular-nums">{detail.series.length}</TableCell><TableCell className="text-muted-foreground">{detail.series.length} series</TableCell><TableCell className="text-right font-mono tabular-nums">{numberBilletes}</TableCell><TableCell>—</TableCell><TableCell /></TableRow>
              {numberOpen && detail.series.map((serie) => { const seriesKey = `${numberKey}/${serie.serie}`; const seriesOpen = openSeries.has(seriesKey); return <Fragment key={seriesKey}><TableRow className={cn('cursor-pointer bg-muted/10', seriesOpen && 'bg-muted/30 hover:bg-muted/30')} onClick={() => toggle(openSeries, seriesKey, setOpenSeries)}><TableCell /><TableCell /><TableCell /><TableCell /><TableCell /><TableCell><span className="ml-3 block border-l-2 border-primary/20 pl-4 font-mono text-sm text-muted-foreground tabular-nums">{detail.numero}</span></TableCell><TableCell className="text-right font-mono tabular-nums">1</TableCell><TableCell className="p-1"><ToggleLabel compact open={seriesOpen} label={serie.serie} onClick={() => toggle(openSeries, seriesKey, setOpenSeries)} /></TableCell><TableCell className="text-right font-mono tabular-nums">{serie.fracciones.length}</TableCell><TableCell className="text-muted-foreground">{serie.fracciones.length} fracc.</TableCell><TableCell /></TableRow>
                {seriesOpen && serie.fracciones.map((fraccion) => <TableRow key={`${seriesKey}/${fraccion}`} className="bg-card"><TableCell /><TableCell /><TableCell /><TableCell /><TableCell /><TableCell><span className="ml-6 block border-l-2 border-primary/20 pl-4 font-mono text-sm text-muted-foreground tabular-nums">{detail.numero}</span></TableCell><TableCell /><TableCell><span className="ml-3 block border-l-2 border-primary/20 pl-4 font-mono text-sm text-muted-foreground tabular-nums">{serie.serie}</span></TableCell><TableCell className="text-right font-mono tabular-nums">1</TableCell><TableCell className="font-mono font-semibold tabular-nums">{fraccion}</TableCell><TableCell /></TableRow>)}</Fragment> })}
            </Fragment> })}
          </Fragment> })}
        </Fragment> })}
      </Fragment> })}
    </TableBody></Table></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null) }}><DialogContent className="sm:max-w-xl" showCloseButton={busyId === null}><DialogHeader><DialogTitle>Modificar registro del albarán</DialogTitle><DialogDescription>Los totales se calculan desde los boletos y no se editan aquí.</DialogDescription></DialogHeader>{draft && <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="origin-id">ID de origen</Label><Input id="origin-id" value={draft.idOrigen} onChange={(event) => updateDraft('idOrigen', event.target.value)} /></div><div><Label htmlFor="origin-type">Tipo de origen</Label><Input id="origin-type" value={draft.tipoOrigen} onChange={(event) => updateDraft('tipoOrigen', event.target.value)} /></div><div className="sm:col-span-2"><Label htmlFor="origin-name">Nombre del albarán</Label><Input id="origin-name" value={draft.nombre} onChange={(event) => updateDraft('nombre', event.target.value)} /></div><div><Label htmlFor="origin-date">Fecha de carga</Label><Input id="origin-date" type="datetime-local" value={draft.fechaCarga.slice(0, 16)} onChange={(event) => updateDraft('fechaCarga', event.target.value)} /></div><div><Label htmlFor="origin-path">Ruta del PDF</Label><Input id="origin-path" value={draft.pdfPath ?? ''} onChange={(event) => updateDraft('pdfPath', event.target.value || null)} /></div><div className="sm:col-span-2"><Label htmlFor="origin-checksum">Checksum del PDF</Label><Input id="origin-checksum" value={draft.pdfChecksum ?? ''} onChange={(event) => updateDraft('pdfChecksum', event.target.value || null)} /></div></div>}<DialogFooter><Button variant="outline" onClick={() => setEditing(null)} disabled={busyId !== null}>Cancelar</Button><Button onClick={() => void save()} disabled={busyId !== null}>{busyId ? 'Guardando…' : 'Guardar cambios'}</Button></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={Boolean(deleteConfirmation)} onOpenChange={(open) => { if (!open) setDeleteConfirmation(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar esta carga?</AlertDialogTitle><AlertDialogDescription>{deleteConfirmation && `Se eliminará «${deleteConfirmation.nombre}» y sus ${deleteConfirmation.totalBoletos} fracciones del inventario.`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busyId !== null}>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busyId !== null} onClick={() => { if (deleteConfirmation) void remove(deleteConfirmation); setDeleteConfirmation(null) }}>Eliminar carga</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(deleteWithSales)} onOpenChange={(open) => { if (!open) setDeleteWithSales(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>La carga tiene ventas asociadas</AlertDialogTitle><AlertDialogDescription>{deleteWithSales && `«${deleteWithSales.origin.nombre}» tiene ${deleteWithSales.salesCount} venta${deleteWithSales.salesCount === 1 ? '' : 's'}. ¿Quieres eliminar también esas ventas?`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busyId !== null}>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busyId !== null} onClick={() => { if (deleteWithSales) void remove(deleteWithSales.origin, true); setDeleteWithSales(null) }}>Eliminar carga y ventas</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>
}
