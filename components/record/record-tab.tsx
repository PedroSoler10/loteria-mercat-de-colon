import { CedidoRecordsTable, ImportDeliveryNotes, ImportedDeliveryNotesTable } from './import-delivery-notes'
import { ImportedSalesTable } from './imported-sales-table'
import { ManualEntry } from './manual-entry'
import type { Albaran, Cedido } from '@/lib/record-data'
import type { Sale } from '@/lib/tpv-data'

type Props = {
  albaranes: Albaran[]
  onManualEntry: () => Promise<void>
  onUpdate: (idOrigen: string, patch: Partial<Pick<Albaran, 'idOrigen' | 'nombre' | 'tipoOrigen' | 'fechaCarga' | 'pdfPath' | 'pdfChecksum'>>) => Promise<string | undefined>
  onDelete: (idOrigen: string, deleteSales?: boolean) => Promise<{ error?: string; salesCount?: number }>
  onImported: () => Promise<void>
  cedidos: Cedido[]
  databasePath: string
  onDatabaseImported: () => Promise<void>
  sales: Sale[]
}

export function RecordTab({ albaranes, onManualEntry, onUpdate, onDelete, onImported, cedidos, databasePath, onDatabaseImported, sales }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ImportDeliveryNotes onImported={onImported} onDatabaseImported={onDatabaseImported} databasePath={databasePath} />
        <ManualEntry onCreated={onManualEntry} />
      </div>
      <ImportedDeliveryNotesTable albaranes={albaranes} onUpdate={onUpdate} onDelete={onDelete} />
      <ImportedSalesTable sales={sales} />
      <CedidoRecordsTable cedidos={cedidos} onUpdate={onUpdate} onDelete={onDelete} />
    </div>
  )
}
