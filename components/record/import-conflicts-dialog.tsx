'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ConflictoImportacion } from '@/lib/boleto-estado'

type Props = {
  archivo: string
  conflictos: ConflictoImportacion[]
  /** Albaranes de la misma tanda que ya se han importado antes de este. */
  anteriores: string[]
  /** Decisiones elegidas (id del boleto -> opción) o `null` si se cancela la importación. */
  onResolve: (decisiones: Record<string, string> | null) => void
}

// En todas las preguntas la primera opción conserva lo que ya hay y la segunda aplica este albarán.
const GRUPOS: Record<ConflictoImportacion['tipo'], { titulo: string; opciones: [string, string] }> = {
  cesion_vendido: { titulo: 'Boletos vendidos que este albarán de cesión incluye', opciones: ['Dejarlos como vendidos', 'Marcarlos como cedidos (las ventas se anulan)'] },
  cesion_cedido: { titulo: 'Boletos ya cedidos por otro albarán', opciones: ['Mantener el albarán que los cedió', 'Cederlos con este albarán'] },
  origen: { titulo: 'Boletos ya cargados con otro origen', opciones: ['Mantener el origen actual', 'Usar este albarán como origen'] },
}

/**
 * Pregunta qué hacer con los boletos de un albarán que ya tienen otro estado u otro origen. Se puede aplicar
 * la misma decisión a todos los de un grupo (o a todos) y, si hace falta, decidir uno a uno.
 */
export function ImportConflictsDialog({ archivo, conflictos, anteriores, onResolve }: Props) {
  const [decisiones, setDecisiones] = useState<Record<string, string>>({})
  const grupos = useMemo(() => {
    const porTipo = new Map<ConflictoImportacion['tipo'], ConflictoImportacion[]>()
    for (const conflicto of conflictos) porTipo.set(conflicto.tipo, [...(porTipo.get(conflicto.tipo) ?? []), conflicto])
    return Array.from(porTipo.entries())
  }, [conflictos])
  const pendientes = conflictos.filter((conflicto) => !decisiones[conflicto.idBoleto]).length

  function decide(lista: ConflictoImportacion[], index: 0 | 1) {
    setDecisiones((actuales) => ({ ...actuales, ...Object.fromEntries(lista.map((conflicto) => [conflicto.idBoleto, conflicto.opciones[index]?.valor ?? ''])) }))
  }
  const elegidaEnTodos = (lista: ConflictoImportacion[], index: 0 | 1) => lista.every((conflicto) => decisiones[conflicto.idBoleto] === conflicto.opciones[index]?.valor)

  return <Dialog open onOpenChange={(open) => { if (!open) onResolve(null) }}>
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Hay boletos que requieren tu decisión</DialogTitle>
        <DialogDescription>
          El albarán «{archivo}» incluye {conflictos.length} boleto{conflictos.length === 1 ? '' : 's'} que ya {conflictos.length === 1 ? 'tiene' : 'tienen'} otro estado u otro origen. Puedes elegir la misma opción para todos o decidir uno a uno. No se guardará nada hasta que continúes.
        </DialogDescription>
      </DialogHeader>

      {grupos.length > 1 && <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-3">
        <span className="text-sm font-medium">Para todo:</span>
        <Button type="button" variant="outline" onClick={() => decide(conflictos, 0)}>Mantener lo que ya hay</Button>
        <Button type="button" variant="outline" onClick={() => decide(conflictos, 1)}>Aplicar este albarán</Button>
      </div>}

      <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1">
        {grupos.map(([tipo, lista]) => {
          const grupo = GRUPOS[tipo]
          const decididos = lista.filter((conflicto) => decisiones[conflicto.idBoleto]).length
          return <section key={tipo} className="rounded-md border p-3" aria-label={grupo.titulo}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{grupo.titulo}</h3>
              <span className="text-sm text-muted-foreground">{lista.length} boleto{lista.length === 1 ? '' : 's'} · {decididos === lista.length ? 'todos decididos' : `${decididos} decididos`}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {([0, 1] as const).map((index) => <Button
                key={index}
                type="button"
                variant={elegidaEnTodos(lista, index) ? 'default' : 'outline'}
                aria-pressed={elegidaEnTodos(lista, index)}
                onClick={() => decide(lista, index)}
              >
                {lista.length > 1 ? `${grupo.opciones[index]} en todos` : grupo.opciones[index]}
              </Button>)}
            </div>
            {lista.length > 1 && <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted-foreground">Decidir uno a uno</summary>
              <ul className="mt-2 flex flex-col gap-2">
                {lista.map((conflicto) => <li key={conflicto.idBoleto} className={cn('rounded-md border p-2', !decisiones[conflicto.idBoleto] && 'border-dashed')}>
                  <p className="font-mono text-sm font-semibold tabular-nums">{conflicto.numeroJugado} / serie {conflicto.serie} / fracción {conflicto.fraccion}</p>
                  <p className="mb-1 text-xs text-muted-foreground">{conflicto.detalle}</p>
                  <div role="radiogroup" aria-label={`Decisión para ${conflicto.numeroJugado} serie ${conflicto.serie} fracción ${conflicto.fraccion}`} className="flex flex-col gap-1">
                    {conflicto.opciones.map((opcion) => <label key={opcion.valor} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={conflicto.idBoleto}
                        checked={decisiones[conflicto.idBoleto] === opcion.valor}
                        onChange={() => setDecisiones((actuales) => ({ ...actuales, [conflicto.idBoleto]: opcion.valor }))}
                      />
                      {opcion.etiqueta}
                    </label>)}
                  </div>
                </li>)}
              </ul>
            </details>}
            {lista.length === 1 && <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-mono tabular-nums">{lista[0].numeroJugado} / serie {lista[0].serie} / fracción {lista[0].fraccion}</span>: {lista[0].detalle}
            </p>}
          </section>
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        «Cancelar importación» no guarda nada de este albarán y lo deja todo como estaba.
        {anteriores.length > 0 && ` Los albaranes de esta tanda ya importados (${anteriores.join(', ')}) se mantienen y los siguientes no se importarán.`}
      </p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onResolve(null)}>Cancelar importación</Button>
        <Button type="button" disabled={pendientes > 0} onClick={() => onResolve(decisiones)}>
          {pendientes > 0 ? `Faltan ${pendientes} por decidir` : 'Continuar'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
