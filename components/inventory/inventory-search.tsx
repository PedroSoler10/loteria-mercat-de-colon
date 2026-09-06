'use client'

import { ScanLine, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export type SearchMode = 'termina' | 'contiene'

type Props = {
  query: string
  onQueryChange: (q: string) => void
  mode: SearchMode
  onModeChange: (m: SearchMode) => void
  onlyAvailable: boolean
  onOnlyAvailableChange: (v: boolean) => void
  resultCount: number
}

export function InventorySearch({
  query,
  onQueryChange,
  mode,
  onModeChange,
  onlyAvailable,
  onOnlyAvailableChange,
  resultCount,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Label htmlFor="tpv-search" className="sr-only">
          Buscar número o lectura de escáner
        </Label>
        <ScanLine
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-primary"
        />
        <Input
          id="tpv-search"
          autoFocus
          inputMode="numeric"
          autoComplete="off"
          placeholder="Escanea un décimo o escribe el número…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value.replace(/\D/g, ''))}
          className="h-14 pl-13 pr-12 font-mono text-2xl tabular-nums tracking-wider placeholder:font-sans placeholder:text-base placeholder:tracking-normal"
        />
        {query && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => onQueryChange('')}
            className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <div role="group" aria-label="Modo de búsqueda" className="flex rounded-md border bg-muted p-1">
        {(['termina', 'contiene'] as SearchMode[]).map((m) => (
          <Button
            key={m}
            type="button"
            variant="ghost"
            aria-pressed={mode === m}
            onClick={() => onModeChange(m)}
            className={cn(
              'h-12 px-5 text-base',
              mode === m && 'bg-card text-primary shadow-sm hover:bg-card',
            )}
          >
            {m === 'termina' ? 'Termina en' : 'Contiene'}
          </Button>
        ))}
      </div>

      <div className="flex h-14 items-center gap-3 rounded-md border px-4">
        <Switch
          id="only-available"
          checked={onlyAvailable}
          onCheckedChange={onOnlyAvailableChange}
          className="scale-125"
        />
        <Label htmlFor="only-available" className="cursor-pointer text-base">
          Mostrar solo disponibles
        </Label>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground lg:pl-2">
        <Search aria-hidden="true" className="size-4" />
        <span className="tabular-nums">
          {resultCount} número{resultCount !== 1 && 's'}
        </span>
      </div>
    </div>
  )
}
