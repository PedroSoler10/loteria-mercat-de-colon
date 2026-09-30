'use client'

import { useEffect, useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
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
import { formatFecha, formatFracciones, parseFracciones, type Sale } from '@/lib/tpv-data'

export type GroupConflict = { fecha: string; numero: string; serie: string; fraccion: string; estado: string }

export type GroupPatch = { fecha: string; numero: string; serie: string; fracciones: number[] }

export type GroupEditResult =
  | { ok: true }
  | { ok: false; error: string; conflicts?: GroupConflict[] }

type Props = {
  sales: Sale[] | null
  onClose: () => void
  onSave: (ids: string[], patch: GroupPatch, overwrite: boolean) => Promise<GroupEditResult>
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EditSalesGroupDialog({ sales, onClose, onSave }: Props) {
  const [fecha, setFecha] = useState('')
  const [numero, setNumero] = useState('')
  const [serie, setSerie] = useState('')
  const [fracciones, setFracciones] = useState('')
  const [conflicts, setConflicts] = useState<GroupConflict[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const original = useMemo(() => (sales ? sales.map((sale) => Number(sale.fraccion)) : []), [sales])

  useEffect(() => {
    if (sales && sales.length > 0) {
      setFecha(toLocalInput(sales[0].fecha))
      setNumero(sales[0].numero)
      setSerie(sales[0].serie)
      setFracciones(formatFracciones(sales.map((sale) => Number(sale.fraccion))))
      setConflicts([])
      setError('')
      setSaving(false)
    }
  }, [sales])

  const parsed = parseFracciones(fracciones)
  const valid = fecha !== '' && numero.trim() !== '' && serie.trim() !== '' && parsed !== null
  const removed = parsed ? original.filter((n) => !parsed.includes(n)) : []
  const added = parsed ? parsed.filter((n) => !original.includes(n)) : []

  function edited() {
    setConflicts([])
    setError('')
  }

  async function save(overwrite: boolean) {
    if (!sales || !valid || !parsed || saving) return
    setSaving(true)
    const result = await onSave(
      sales.map((sale) => sale.id),
      { fecha: new Date(fecha).toISOString(), numero: numero.trim(), serie: serie.trim(), fracciones: parsed },
      overwrite,
    )
    setSaving(false)
    if (result.ok) {
      onClose()
      return
    }
    setConflicts(result.conflicts ?? [])
    setError(result.conflicts?.length ? '' : result.error)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    void save(false)
  }

  return (
    <Dialog open={Boolean(sales)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Corregir ventas</DialogTitle>
            <DialogDescription>
              {sales?.length === 1 ? 'Se corrige 1 fracción vendida' : `Se corrigen ${sales?.length ?? 0} fracciones vendidas`} en el mismo minuto.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-group-numero">Número</Label>
              <Input id="edit-group-numero" inputMode="numeric" value={numero} onChange={(e) => { setNumero(e.target.value.replace(/\D/g, '')); edited() }} className="h-10 font-mono tabular-nums" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-group-serie">Serie</Label>
              <Input id="edit-group-serie" inputMode="numeric" value={serie} onChange={(e) => { setSerie(e.target.value.replace(/\D/g, '')); edited() }} className="h-10 font-mono tabular-nums" />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="edit-group-fracciones">Fracciones</Label>
              <Input
                id="edit-group-fracciones"
                value={fracciones}
                onChange={(e) => { setFracciones(e.target.value.replace(/[^\d\-, ]/g, '')); edited() }}
                placeholder="Ej. 1-10 o 1-3, 5"
                aria-invalid={parsed === null}
                className="h-10 font-mono tabular-nums"
              />
              {parsed === null ? (
                <p className="text-xs text-destructive">Escribe un rango (1-10) o una lista (1-3, 5) de fracciones.</p>
              ) : (
                (removed.length > 0 || added.length > 0) && (
                  <p className="text-xs text-muted-foreground">
                    {added.length > 0 && <>Se registrarán como vendidas: {formatFracciones(added)}. </>}
                    {removed.length > 0 && <>Se anularán (podrás recuperarlas): {formatFracciones(removed)}.</>}
                  </p>
                )
              )}
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="edit-group-fecha">Fecha y hora</Label>
              <Input id="edit-group-fecha" type="datetime-local" value={fecha} onChange={(e) => { setFecha(e.target.value); edited() }} className="h-10 font-mono tabular-nums" />
            </div>
          </div>

          {conflicts.length > 0 && (
            <div role="alert" className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold text-destructive">
                <TriangleAlert className="size-4" aria-hidden="true" />
                Se sobrescribirán {conflicts.length === 1 ? 'esta venta anterior' : `estas ${conflicts.length} ventas anteriores`}
              </p>
              <p className="text-muted-foreground">
                Ya existen ventas de {numero}/{serie} en esas fracciones. Si continúas, se borrarán definitivamente y las ventas corregidas ocuparán su lugar:
              </p>
              <ul className="max-h-40 overflow-y-auto font-mono text-xs tabular-nums">
                {[...conflicts].sort((a, b) => Number(a.fraccion) - Number(b.fraccion)).map((conflict) => (
                  <li key={`${conflict.numero}-${conflict.serie}-${conflict.fraccion}`}>
                    {formatFecha(conflict.fecha)} · número {conflict.numero} · serie {conflict.serie} · fracción {Number(conflict.fraccion)}
                    {conflict.estado === 'anulada' ? ' (anulada)' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {conflicts.length > 0 ? (
              <Button type="button" variant="destructive" disabled={saving} onClick={() => void save(true)}>
                Sobrescribir y guardar
              </Button>
            ) : (
              <Button type="submit" disabled={!valid || saving}>
                Guardar cambios
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
