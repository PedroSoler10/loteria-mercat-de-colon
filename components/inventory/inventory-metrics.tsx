import type { StockCounts } from '@/lib/record-data'
import { cn } from '@/lib/utils'

type Props = { counts: StockCounts }

export function InventoryMetrics({ counts }: Props) {
  const availablePercentage = counts.recibidos > 0 ? (counts.disponibles / counts.recibidos) * 100 : 0
  const cards: { label: string; value: number | string; tone: 'neutral' | 'primary' | 'accent' }[] = [
    { label: 'Recibidos', value: counts.recibidos, tone: 'neutral' },
    { label: 'Cedidos', value: counts.cedidos, tone: 'accent' },
    { label: 'Vendidos', value: counts.vendidos, tone: 'accent' },
    { label: 'Disponibles', value: counts.disponibles, tone: 'primary' },
    { label: '% disponibles / recibidos', value: `${availablePercentage.toLocaleString('es-ES', { maximumFractionDigits: 2 })}%`, tone: 'primary' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5" aria-live="polite">
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn(
            'flex flex-col gap-1 rounded-lg border px-5 py-4 shadow-sm',
            c.tone === 'neutral' && 'bg-card',
            c.tone === 'primary' && 'border-primary bg-primary text-primary-foreground',
            c.tone === 'accent' && 'border-accent bg-accent text-accent-foreground',
          )}
        >
          <span
            className={cn(
              'text-xs font-semibold uppercase tracking-widest',
              c.tone === 'neutral' ? 'text-muted-foreground' : 'opacity-80',
            )}
          >
            {c.label}
          </span>
          <span className="font-mono text-4xl font-semibold tabular-nums leading-none">
            {typeof c.value === 'number' ? c.value.toLocaleString('es-ES') : c.value}
          </span>
        </div>
      ))}
    </div>
  )
}
