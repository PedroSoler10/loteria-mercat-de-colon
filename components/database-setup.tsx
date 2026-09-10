'use client'

import { useEffect, useRef, useState } from 'react'
import { Database, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = { onReady: () => Promise<void> }

export function DatabaseSetup({ onReady }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function initialize() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/database', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initialize: true }) })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo crear la base de datos')
      await onReady()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear la base de datos')
    } finally {
      setBusy(false)
    }
  }

  async function importDatabase() {
    const file = inputRef.current?.files?.[0]
    if (!file) {
      setError('Selecciona un archivo .db, .sqlite o .sqlite3.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/database', { method: 'POST', body: formData })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo importar la base de datos')
      await onReady()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo importar la base de datos')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <section className="w-full max-w-xl rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <Database className="size-6 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold">Configurar base de datos</h1>
            <p className="text-sm text-muted-foreground">Es la primera vez que se inicia esta instalación.</p>
          </div>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Importa una base de datos existente o empieza con una base nueva. La aplicación no utilizará el resto de funciones hasta completar este paso.
        </p>
        <div className="flex flex-col gap-3">
          <Input ref={inputRef} type="file" accept=".db,.sqlite,.sqlite3" />
          <Button type="button" onClick={() => void importDatabase()} disabled={busy}>
            <Upload /> {busy ? 'Importando…' : 'Importar base de datos'}
          </Button>
          <Button type="button" variant="outline" onClick={() => void initialize()} disabled={busy}>
            <Database /> Empezar con una base nueva
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          La base nueva se guardará en la carpeta de datos de esta instalación. Podrás hacer una copia o cambiar su ubicación desde Registro.
        </p>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </section>
    </main>
  )
}
