'use client'

import { useEffect, useRef, useState } from 'react'
import { Database, Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string
    types?: Array<{ description: string; accept: Record<string, string[]> }>
  }) => Promise<FileSystemFileHandle>
}

export function DatabaseSettings() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [databasePath, setDatabasePath] = useState('')
  const [destinationPath, setDestinationPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/database', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo consultar la ubicación de la base de datos')
        const result = await response.json() as { path: string }
        setDatabasePath(result.path)
      })
      .catch((error) => setFeedback(error instanceof Error ? error.message : 'No se pudo consultar la base de datos'))
  }, [])

  async function importDatabase() {
    const file = fileInput.current?.files?.[0]
    if (!file) {
      setFeedback('Selecciona primero un archivo .db')
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/database', { method: 'POST', body: formData })
      const result = await response.json() as { error?: string; path?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo importar la base de datos')
      setDatabasePath(result.path ?? databasePath)
      setFeedback('Base de datos importada. Recarga la página para ver sus datos.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo importar la base de datos')
    } finally {
      setBusy(false)
    }
  }

  async function saveToLocation() {
    if (!destinationPath.trim()) {
      setFeedback('Escribe una ruta absoluta, por ejemplo C:\\Datos\\loteria.db')
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: destinationPath.trim() }),
      })
      const result = await response.json() as { error?: string; path?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo guardar la base de datos')
      setDatabasePath(result.path ?? destinationPath.trim())
      setFeedback('Ubicación guardada. Cierra y vuelve a abrir la aplicación para empezar a usarla.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar la base de datos')
    } finally {
      setBusy(false)
    }
  }

  async function browseAndSave() {
    const picker = (window as SaveFilePickerWindow).showSaveFilePicker
    if (!picker) {
      setFeedback('Este navegador no permite abrir el explorador para guardar. Escribe la ruta completa manualmente.')
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/database/download')
      if (!response.ok) throw new Error('No se pudo preparar la copia de la base de datos')
      const handle = await picker({
        suggestedName: 'loteria.db',
        types: [{ description: 'Base de datos SQLite', accept: { 'application/octet-stream': ['.db', '.sqlite', '.sqlite3'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(await response.blob())
      await writable.close()
      setFeedback('Copia guardada en la ubicación elegida. Para usarla como base activa, copia su ruta completa en el campo y pulsa «Guardar en esta ubicación».')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar la copia')
    } finally {
      setBusy(false)
    }
  }

  async function downloadDatabase() {
    const response = await fetch('/api/database/download')
    if (!response.ok) {
      setFeedback('No se pudo descargar la base de datos')
      return
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'loteria-backup.db'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section aria-labelledby="database-title" className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <Database className="size-5 text-primary" aria-hidden="true" />
        <div>
          <h2 id="database-title" className="text-lg font-semibold">Base de datos</h2>
          <p className="text-sm text-muted-foreground">Importa una copia o elige dónde conservarla.</p>
        </div>
      </div>
      <p className="mb-4 break-all rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Ubicación actual: {databasePath || 'cargando…'}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="database-file">Importar una base de datos SQLite</Label>
          <Input id="database-file" ref={fileInput} type="file" accept=".db,.sqlite,.sqlite3" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}>
              <Upload /> Examinar…
            </Button>
            <Button type="button" variant="outline" onClick={() => void importDatabase()} disabled={busy}>
              {busy ? 'Importando…' : 'Importar archivo'}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="database-path">Guardar y usar otra ubicación</Label>
          <Input
            id="database-path"
            value={destinationPath}
            onChange={(event) => setDestinationPath(event.target.value)}
            placeholder="C:\Datos\loteria.db"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void browseAndSave()} disabled={busy}>
              <Database /> Examinar y guardar copia
            </Button>
            <Button type="button" variant="outline" onClick={() => void saveToLocation()} disabled={busy}>
              Guardar y usar ruta
            </Button>
          </div>
        </div>
      </div>
      <Button type="button" variant="ghost" className="mt-3" onClick={() => void downloadDatabase()}>
        <Download /> Descargar copia de seguridad
      </Button>
      {feedback && <p role="status" className="mt-3 text-sm text-muted-foreground">{feedback}</p>}
    </section>
  )
}
