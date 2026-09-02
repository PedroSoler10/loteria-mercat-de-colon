import type { StockCounts } from '@/lib/inventory-data'
import { cn } from '@/lib/utils'

type Props = { counts: StockCounts }

export function TpvMetrics({ counts }: Props) {
  const cards: { label: string; value: number; tone: 'neutral' | 'primary' | 'accent' }[] = [
    { label: 'Recibidos', value: counts.recibidos, tone: 'neutral' },
    { label: 'Disponibles', value: counts.disponibles, tone: 'primary' },
    { label: 'Vendidos', value: counts.vendidos, tone: 'accent' },
  ]

  return (
    <div className="grid grid-cols-3 gap-4" aria-live="polite">
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
            {c.value.toLocaleString('es-ES')}
          </span>
        </div>
      ))}
    </div>
  )
}
