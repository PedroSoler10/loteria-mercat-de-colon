'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  max: number
  onSell: (qty: number) => void
  label: string
  size?: 'lg' | 'md'
}

export function SellControl({ max, onSell, label, size = 'lg' }: Props) {
  const [qty, setQty] = useState(1)

  useEffect(() => {
    setQty((q) => Math.min(Math.max(1, q), Math.max(1, max)))
  }, [max])

  const disabled = max <= 0
  const lg = size === 'lg'

  return (
    <div
      className="flex items-center justify-end gap-2"
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label={label}
    >
      <div
        className={cn(
          'flex items-center rounded-md border bg-card',
          disabled && 'opacity-40',
          lg ? 'h-11' : 'h-9',
        )}
      >
        <button
          type="button"
          aria-label="Restar uno"
          disabled={disabled || qty <= 1}
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className={cn(
            'flex items-center justify-center rounded-l-md text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40',
            lg ? 'size-11' : 'size-9',
          )}
        >
          <Minus className="size-4" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          aria-label="Cantidad a vender"
          min={1}
          max={Math.max(1, max)}
          value={qty}
          disabled={disabled}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (Number.isFinite(v)) setQty(Math.min(Math.max(1, Math.floor(v)), Math.max(1, max)))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !disabled) onSell(qty)
          }}
          className={cn(
            'w-12 border-x bg-transparent text-center font-mono font-semibold tabular-nums outline-none focus-visible:bg-primary/5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            lg ? 'h-11 text-lg' : 'h-9 text-base',
          )}
        />
        <button
          type="button"
          aria-label="Sumar uno"
          disabled={disabled || qty >= max}
          onClick={() => setQty((q) => Math.min(max, q + 1))}
          className={cn(
            'flex items-center justify-center rounded-r-md text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40',
            lg ? 'size-11' : 'size-9',
          )}
        >
          <Plus className="size-4" />
        </button>
      </div>
      <Button
        type="button"
        disabled={disabled}
        onClick={() => onSell(qty)}
        className={cn(
          'bg-accent font-semibold text-accent-foreground shadow-sm hover:bg-accent/90',
          lg ? 'h-11 px-6 text-base' : 'h-9 px-4',
        )}
      >
        Vender
      </Button>
    </div>
  )
}
