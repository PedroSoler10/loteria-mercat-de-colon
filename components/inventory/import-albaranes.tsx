'use client'

import { useRef, useState } from 'react'
import { FileUp, FileText } from 'lucide-react'
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
import type { Albaran } from '@/lib/inventory-data'

type Props = {
  albaranes: Albaran[]
}

export function ImportAlbaranes({ albaranes }: Props) {
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files) return
    const names = Array.from(files)
      .filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      .map((f) => f.name)
    if (names.length) setPending((prev) => [...prev, ...names])
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
            {pending.map((name, i) => (
              <li key={`${name}-${i}`} className="flex items-center gap-2 text-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button size="lg" className="h-11 flex-1 text-base" onClick={() => setPending([])}>
              Procesar
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 text-base"
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
              <TableHead className="text-right">Números Diferentes</TableHead>
              <TableHead className="text-right">Total Boletos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {albaranes.map((a) => (
              <TableRow key={a.idOrigen}>
                <TableCell className="font-mono text-sm">{a.idOrigen}</TableCell>
                <TableCell>{a.nombre}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{a.numerosDiferentes}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{a.totalBoletos}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
