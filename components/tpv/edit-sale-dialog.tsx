'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Sale } from '@/lib/tpv-data'

type Props = {
  sale: Sale | null
  onClose: () => void
  onSave: (id: string, patch: Pick<Sale, 'fecha' | 'precio' | 'numero' | 'serie' | 'fraccion'>) => boolean
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EditSaleDialog({ sale, onClose, onSave }: Props) {
  const [fecha, setFecha] = useState('')
  const [precio, setPrecio] = useState('')
  const [numero, setNumero] = useState('')
  const [serie, setSerie] = useState('')
  const [fraccion, setFraccion] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (sale) {
      setFecha(toLocalInput(sale.fecha))
      setPrecio(String(sale.precio))
      setNumero(sale.numero)
      setSerie(sale.serie)
      setFraccion(sale.fraccion)
      setError('')
    }
  }, [sale])

  const precioNum = Number(precio.replace(',', '.'))
  const valid =
    fecha !== '' &&
    numero.trim() !== '' &&
    serie.trim() !== '' &&
    fraccion.trim() !== '' &&
    Number.isFinite(precioNum) &&
    precioNum >= 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!sale || !valid) return
    const saved = onSave(sale.id, {
      fecha: new Date(fecha).toISOString(),
      precio: precioNum,
      numero: numero.trim(),
      serie: serie.trim(),
      fraccion: fraccion.trim(),
    })
    if (saved) onClose()
    else setError('El boleto no existe o ya está vendido por otra operación.')
  }

  return (
    <Dialog open={Boolean(sale)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Corregir venta</DialogTitle>
            <DialogDescription>Corrige los datos de la operación y del boleto vendido.</DialogDescription>
          </DialogHeader>

          {sale && (
            <div className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-3 font-mono tabular-nums">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Boleto</span>
              <span className="text-lg font-semibold">{numero} / {serie} / {fraccion}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-numero">Número</Label>
              <Input id="edit-numero" inputMode="numeric" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} className="h-10 font-mono tabular-nums" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-serie">Serie</Label>
              <Input id="edit-serie" inputMode="numeric" value={serie} onChange={(e) => setSerie(e.target.value.replace(/\D/g, ''))} className="h-10 font-mono tabular-nums" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-fraccion">Fracción</Label>
              <Input id="edit-fraccion" inputMode="numeric" value={fraccion} onChange={(e) => setFraccion(e.target.value.replace(/\D/g, ''))} className="h-10 font-mono tabular-nums" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-fecha">Fecha y hora</Label>
              <Input
                id="edit-fecha"
                type="datetime-local"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-10 font-mono tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-precio">Precio (€)</Label>
              <Input
                id="edit-precio"
                inputMode="decimal"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="h-10 font-mono tabular-nums"
              />
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="items-center gap-3 sm:justify-between">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4" aria-hidden="true" />
              El arqueo se recalcula al guardar
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!valid}>
                Guardar cambios
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
