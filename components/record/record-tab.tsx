import { CedidoRecordsTable, ImportDeliveryNotes, ImportedDeliveryNotesTable } from './import-delivery-notes'
import { ManualEntry } from './manual-entry'
import type { Albaran, Cedido } from '@/lib/record-data'

type Props = {
  albaranes: Albaran[]
  onManualEntry: () => Promise<void>
  onUpdate: (idOrigen: string, patch: Partial<Pick<Albaran, 'idOrigen' | 'nombre' | 'tipoOrigen' | 'fechaCarga' | 'pdfPath' | 'pdfChecksum'>>) => Promise<string | undefined>
  onDelete: (idOrigen: string, deleteSales?: boolean) => Promise<{ error?: string; salesCount?: number }>
  onImported: () => Promise<void>
  cedidos: Cedido[]
}

export function RecordTab({ albaranes, onManualEntry, onUpdate, onDelete, onImported, cedidos }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ImportDeliveryNotes onImported={onImported} onDatabaseImported={onImported} />
        <ManualEntry onCreated={onManualEntry} />
      </div>
      <ImportedDeliveryNotesTable albaranes={albaranes} onUpdate={onUpdate} onDelete={onDelete} />
      <CedidoRecordsTable cedidos={cedidos} onUpdate={onUpdate} onDelete={onDelete} />
    </div>
  )
}
