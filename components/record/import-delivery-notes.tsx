'use client'

import { useRef, useState } from 'react'
import { FileUp, FileText, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { Albaran, CargaDetalle } from '@/lib/record-data'

type Props = {
  albaranes: Albaran[]
  onRename: (idOrigen: string, nombre: string) => Promise<string | undefined>
  onDelete: (idOrigen: string) => Promise<string | undefined>
  onImported: () => Promise<void>
}

function isCompleteSeries(fracciones: string[]) {
  return fracciones.length === 10 && fracciones.every((fraccion, index) => fraccion === String(index + 1).padStart(2, '0'))
}

function groupSeries(series: CargaDetalle['series']) {
  const groups: { label: string; fracciones: string[] }[] = []
  for (const current of series) {
    const currentNumber = Number(current.serie)
    const last = groups[groups.length - 1]
    const lastParts = last?.label.split('-')
    const lastEnd = lastParts ? Number(lastParts[lastParts.length - 1]) : undefined
    if (isCompleteSeries(current.fracciones) && last && last.fracciones.length === 10 && lastEnd === currentNumber - 1) {
      const [start] = last.label.split('-')
      last.label = `${start}-${currentNumber}`
    } else {
      groups.push({
        label: String(currentNumber),
        fracciones: current.fracciones,
      })
    }
  }
  return groups
}

function DetailColumn({ detalles, kind }: { detalles?: CargaDetalle[]; kind: 'numbers' | 'series' | 'fractions' }) {
  if (!detalles?.length) return <span className="text-muted-foreground">Sin detalle</span>

  return (
    <div className="space-y-1 text-sm">
      {detalles.map((detalle) => {
        if (kind === 'numbers') {
          return <div key={detalle.numero} className="font-mono font-semibold tabular-nums">{detalle.numero}</div>
        }

        return (
          <div key={detalle.numero} className="space-y-1">
            {groupSeries(detalle.series).map((serie) => (
              <div key={`${detalle.numero}-${serie.label}`} className="font-mono tabular-nums">
                {kind === 'series'
                  ? serie.label
                  : isCompleteSeries(serie.fracciones) ? '1-10' : serie.fracciones.join(', ')}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export function ImportDeliveryNotes({ albaranes, onRename, onDelete, onImported }: Props) {
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState<File[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [processing, setProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files) return
    const pdfs = Array.from(files).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length) setPending((prev) => [...prev, ...pdfs])
  }

  async function processPending() {
    if (pending.length === 0) return
    setProcessing(true)
    setActionError('')
    try {
      for (const file of pending) {
        const formData = new FormData()
        formData.append('file', file)
        const response = await fetch('/api/delivery-notes', { method: 'POST', body: formData })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? `No se pudo procesar ${file.name}`)
      }
      setPending([])
      await onImported()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo procesar el albarán')
    } finally {
      setProcessing(false)
    }
  }

  async function rename(origin: Albaran) {
    const nombre = window.prompt('Nuevo nombre de la carga', origin.nombre)?.trim()
    if (!nombre || nombre === origin.nombre) return
    setBusyId(origin.idOrigen)
    setActionError('')
    const error = await onRename(origin.idOrigen, nombre)
    if (error) setActionError(error)
    setBusyId(null)
  }

  async function remove(origin: Albaran) {
    if (!window.confirm(`¿Eliminar la carga «${origin.nombre}» y sus ${origin.totalBoletos} boletos?`)) return
    setBusyId(origin.idOrigen)
    setActionError('')
    const error = await onDelete(origin.idOrigen)
    if (error) setActionError(error)
    setBusyId(null)
  }

  return (
    <section
      aria-labelledby="import-title"
      className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 id="import-title" className="text-lg font-semibold">
          Importar albaranes
        </h2>
        <span className="text-sm text-muted-foreground">{albaranes.length} importados</span>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Zona para soltar albaranes PDF"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-8 text-center transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          dragging
            ? 'border-accent bg-accent/10'
            : 'border-input bg-muted/40 hover:border-primary/40 hover:bg-muted',
        )}
      >
        <FileUp className="size-8 text-primary" aria-hidden="true" />
        <p className="text-base font-medium">Arrastra aquí los albaranes PDF</p>
        <p className="text-sm text-muted-foreground">o haz clic para seleccionarlos</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {pending.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-accent/50 bg-accent/10 p-3">
          <p className="text-sm font-medium text-accent-foreground">
            {pending.length} archivo{pending.length > 1 ? 's' : ''} pendiente
            {pending.length > 1 ? 's' : ''} de procesar
          </p>
          <ul className="flex flex-col gap-1">
            {pending.map((file, i) => (
              <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{file.name}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button size="lg" className="h-11 flex-1 text-base" disabled={processing} onClick={() => void processPending()}>
              {processing ? 'Procesando…' : 'Procesar'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 text-base"
              disabled={processing}
              onClick={() => setPending([])}
            >
              Descartar
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>ID Origen</TableHead>
              <TableHead>Nombre Albarán</TableHead>
              <TableHead className="text-right">Total Fracciones</TableHead>
              <TableHead className="text-right">Fracciones</TableHead>
              <TableHead>Números</TableHead>
              <TableHead>Series</TableHead>
              <TableHead>Fracciones</TableHead>
              <TableHead className="w-24 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {albaranes.map((a) => (
              <TableRow key={a.idOrigen}>
                <TableCell className="font-mono text-sm">{a.idOrigen}</TableCell>
                <TableCell>{a.nombre}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{a.numerosDiferentes}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{a.totalBoletos}</TableCell>
                <TableCell><DetailColumn detalles={a.detalles} kind="numbers" /></TableCell>
                <TableCell><DetailColumn detalles={a.detalles} kind="series" /></TableCell>
                <TableCell><DetailColumn detalles={a.detalles} kind="fractions" /></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Modificar nombre de la carga"
                      aria-label={`Modificar ${a.nombre}`}
                      disabled={busyId !== null}
                      onClick={() => void rename(a)}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Eliminar carga"
                      aria-label={`Eliminar ${a.nombre}`}
                      disabled={busyId !== null}
                      onClick={() => void remove(a)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
    </section>
  )
}
