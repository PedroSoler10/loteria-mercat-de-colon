'use client'

import { useEffect, useState } from 'react'
import { ScanLine, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type SaleMode = 'fraccion' | 'serie'

type Props = {
  mode: SaleMode
  onModeChange: (mode: SaleMode) => void
  onScan: (code: string, mode: SaleMode) => number
}

export function TpvSaleSearch({ mode, onModeChange, onScan }: Props) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!code) return
    const timer = window.setTimeout(() => {
      const soldCount = onScan(code, mode)
      if (soldCount > 0) {
        setCode('')
        setMessage(`${soldCount} ${soldCount === 1 ? 'fracción vendida' : 'fracciones vendidas'}`)
      } else {
        setMessage('Código no disponible')
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [code, mode, onScan])

  function submitScan() {
    if (!code) return
    const soldCount = onScan(code, mode)
    if (soldCount > 0) {
      setCode('')
      setMessage(`${soldCount} ${soldCount === 1 ? 'fracción vendida' : 'fracciones vendidas'}`)
    } else {
      setMessage('Código no disponible')
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <Label htmlFor="tpv-sale-search" className="text-base font-semibold">
        Venta rápida
      </Label>
      <div className="relative">
        <ScanLine
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-primary"
        />
        <Input
          id="tpv-sale-search"
          autoFocus
          inputMode="numeric"
          autoComplete="off"
          placeholder="Escanea el código del boleto"
          value={code}
          onChange={(event) => {
            setCode(event.target.value.replace(/[^0-9/ -]/g, ''))
            setMessage('')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitScan()
          }}
          className="h-14 pl-13 pr-12 font-mono text-2xl tabular-nums tracking-wider placeholder:font-sans placeholder:text-base placeholder:tracking-normal"
        />
        {code && (
          <button
            type="button"
            aria-label="Limpiar código"
            onClick={() => {
              setCode('')
              setMessage('')
            }}
            className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        )}
      </div>
      <div role="radiogroup" aria-label="Tipo de venta" className="flex w-fit rounded-md border bg-muted p-1">
        {(['fraccion', 'serie'] as SaleMode[]).map((saleMode) => (
          <Button
            key={saleMode}
            type="button"
            variant="ghost"
            role="radio"
            aria-checked={mode === saleMode}
            onClick={() => onModeChange(saleMode)}
            className={cn(
              'h-10 px-6 text-base',
              mode === saleMode && 'bg-card text-primary shadow-sm hover:bg-card',
            )}
          >
            {saleMode === 'fraccion' ? 'Fracción' : 'Serie'}
          </Button>
        ))}
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {message || (mode === 'fraccion' ? 'Se venderá un boleto unitario.' : 'Se venderá la serie completa.')}
      </p>
    </section>
  )
}