'use client'

import { useState } from 'react'
import { ScanBarcode, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { parseSelaeBarcode } from '@/lib/selae-barcode'

type NumericFieldProps = {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
  className?: string
}

function NumericField({ id, label, hint, value, onChange, maxLength, className }: NumericFieldProps) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 text-sm">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={maxLength}
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="h-11 font-mono text-base tabular-nums"
      />
      <p id={hint ? `${id}-hint` : undefined} className="mt-1 h-4 truncate text-xs text-muted-foreground">
        {hint ?? ''}
      </p>
    </div>
  )
}

type Props = {
  onCreated: () => Promise<void>
}

export function ManualEntry({ onCreated }: Props) {
  const [scan, setScan] = useState('')
  const [tipoJuego, setTipoJuego] = useState('5')
  const [sorteo, setSorteo] = useState('102')
  const [anio, setAnio] = useState('2026')
  const [numero, setNumero] = useState('')
  const [serie, setSerie] = useState('')
  const [serieHasta, setSerieHasta] = useState('')
  const [fraccion, setFraccion] = useState('')
  const [digitosControl, setDigitosControl] = useState('0000')
  const [isFullSeries, setIsFullSeries] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleScan(value: string) {
    setScan(value)
    try {
      const barcode = parseSelaeBarcode(value)
      setTipoJuego(String(barcode.tipoJuego))
      setSorteo(String(barcode.numeroSorteo).padStart(3, '0'))
      setNumero(barcode.numeroJugado)
      setSerie(barcode.serie)
      setSerieHasta(barcode.serie)
      setFraccion(barcode.fraccion)
      setDigitosControl(barcode.digitosControl)
      setIsFullSeries(false)
      setFeedback(null)
    } catch {
      // El formulario sigue permitiendo completar manualmente un código parcial.
    }
  }

  function reset() {
    setScan('')
    setNumero('')
    setSerie('')
    setSerieHasta('')
    setFraccion('')
    setDigitosControl('0000')
  }

  async function submit() {
    setSaving(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/manual-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan, tipoJuego, sorteo, anio, numero, serie, serieHasta, fraccion, digitosControl, isFullSeries }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'No se pudo dar de alta')
      await onCreated()
      setFeedback({ type: 'success', text: `${result.count} décimo${result.count === 1 ? '' : 's'} dado${result.count === 1 ? '' : 's'} de alta` })
      reset()
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo dar de alta' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-labelledby="manual-title"
      className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 id="manual-title" className="text-lg font-semibold">
          Alta manual · Incidencias
        </h2>
        <span className="text-sm text-muted-foreground">Escáner o teclado</span>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div>
          <Label htmlFor="scan" className="mb-1.5 text-sm">
            Lectura de Escáner
          </Label>
          <div className="relative">
            <ScanBarcode
              className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-primary"
              aria-hidden="true"
            />
            <Input
              id="scan"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="Escanea el código del décimo…"
              value={scan}
              onChange={(e) => handleScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
              className="h-16 border-2 border-primary/40 bg-primary/5 pl-14 font-mono text-2xl tracking-wider tabular-nums placeholder:font-sans placeholder:text-base placeholder:tracking-normal focus-visible:border-primary"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" />
            <div className="flex flex-col">
              <Label htmlFor="full-series" className="text-sm font-medium">
                Serie completa
              </Label>
              <p className="text-xs text-muted-foreground">Dar de alta todas las fracciones</p>
            </div>
          </div>
          <Switch id="full-series" checked={isFullSeries} onCheckedChange={setIsFullSeries} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <NumericField
            id="tipo-juego"
            label="Tipo de Juego"
            hint="5 = Lotería Nacional"
            value={tipoJuego}
            onChange={setTipoJuego}
            maxLength={2}
          />
          <NumericField
            id="sorteo"
            label="Nº Sorteo"
            hint="102 = Navidad"
            value={sorteo}
            onChange={setSorteo}
            maxLength={3}
          />
          <NumericField
            id="anio"
            label="Año de Emisión"
            value={anio}
            onChange={setAnio}
            maxLength={4}
          />
          <NumericField
            id="numero"
            label="Número"
            value={numero}
            onChange={setNumero}
            maxLength={5}
          />
          <NumericField
            id="serie"
            label={isFullSeries ? 'Serie desde' : 'Serie'}
            value={serie}
            onChange={setSerie}
            maxLength={3}
          />
          {isFullSeries ? (
            <NumericField
              id="serie-hasta"
              label="Serie hasta"
              value={serieHasta}
              onChange={setSerieHasta}
              maxLength={3}
            />
          ) : (
            <NumericField
              id="fraccion"
              label="Fracción"
              value={fraccion}
              onChange={setFraccion}
              maxLength={2}
            />
          )}
            <NumericField
              id="digitos-control"
              label="Dígitos de control"
              hint="0000 si no se conocen"
              value={digitosControl}
              onChange={setDigitosControl}
              maxLength={4}
            />
        </div>

        <div className="mt-auto flex gap-2">
          <Button type="submit" size="lg" className="h-12 flex-1 text-base" disabled={saving}>
            {saving ? 'Guardando…' : 'Dar de alta'}
          </Button>
          <Button type="button" size="lg" variant="outline" className="h-12 text-base" onClick={reset}>
            Limpiar
          </Button>
        </div>
        {feedback && (
          <p role={feedback.type === 'error' ? 'alert' : 'status'} className={feedback.type === 'error' ? 'text-sm text-destructive' : 'text-sm text-primary'}>
            {feedback.text}
          </p>
        )}
      </form>
    </section>
  )
}
