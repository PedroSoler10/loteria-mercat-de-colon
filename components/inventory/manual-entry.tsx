'use client'

import { useState } from 'react'
import { ScanBarcode, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

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

export function ManualEntry() {
  const [scan, setScan] = useState('')
  const [tipoJuego, setTipoJuego] = useState('5')
  const [sorteo, setSorteo] = useState('102')
  const [anio, setAnio] = useState('2026')
  const [numero, setNumero] = useState('')
  const [serie, setSerie] = useState('')
  const [serieHasta, setSerieHasta] = useState('')
  const [fraccion, setFraccion] = useState('')
  const [isFullSeries, setIsFullSeries] = useState(false)

  function reset() {
    setScan('')
    setNumero('')
    setSerie('')
    setSerieHasta('')
    setFraccion('')
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
          reset()
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
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  e.preventDefault()
                  reset()
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
        </div>

        <div className="mt-auto flex gap-2">
          <Button type="submit" size="lg" className="h-12 flex-1 text-base">
            Dar de alta
          </Button>
          <Button type="button" size="lg" variant="outline" className="h-12 text-base" onClick={reset}>
            Limpiar
          </Button>
        </div>
      </form>
    </section>
  )
}
