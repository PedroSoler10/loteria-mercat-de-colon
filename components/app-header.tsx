'use client'

import { cn } from '@/lib/utils'

export const TABS = ['Registro', 'Inventario', 'TPV', 'Análisis'] as const
export type Tab = (typeof TABS)[number]

type AppHeaderProps = {
  active: Tab
  onChange: (tab: Tab) => void
}

export function AppHeader({ active, onChange }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-primary text-primary-foreground shadow-sm">
      <div className="flex h-14 items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Lotería Mercat de Colón</h1>
      </div>
      <nav aria-label="Navegación principal" className="border-t border-primary-foreground/10 bg-card px-6">
        <ul role="tablist" className="flex w-full justify-center gap-2">
          {TABS.map((tab) => {
            const isActive = tab === active
            return (
              <li key={tab}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab}`}
                  onClick={() => onChange(tab)}
                  className={cn(
                    'relative h-14 min-w-40 px-6 text-base font-medium transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
                    isActive
                      ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:bg-accent'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  {tab}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}
