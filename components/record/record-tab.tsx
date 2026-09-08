import { ImportDeliveryNotes, ImportedDeliveryNotesTable } from './import-delivery-notes'
import { ManualEntry } from './manual-entry'
import type { Albaran } from '@/lib/record-data'

type Props = {
  albaranes: Albaran[]
  onManualEntry: () => Promise<void>
  onUpdate: (idOrigen: string, patch: Partial<Pick<Albaran, 'idOrigen' | 'nombre' | 'tipoOrigen' | 'fechaCarga' | 'pdfPath' | 'pdfChecksum'>>) => Promise<string | undefined>
  onDelete: (idOrigen: string, deleteSales?: boolean) => Promise<{ error?: string; salesCount?: number }>
  onImported: () => Promise<void>
}

export function RecordTab({ albaranes, onManualEntry, onUpdate, onDelete, onImported }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ImportDeliveryNotes onImported={onImported} />
        <ManualEntry onCreated={onManualEntry} />
      </div>
      <ImportedDeliveryNotesTable albaranes={albaranes} onUpdate={onUpdate} onDelete={onDelete} />
    </div>
  )
}
