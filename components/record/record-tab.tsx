import { ImportDeliveryNotes } from './import-delivery-notes'
import { ManualEntry } from './manual-entry'
import type { Albaran } from '@/lib/record-data'

type Props = {
  albaranes: Albaran[]
  onManualEntry: () => Promise<void>
  onRename: (idOrigen: string, nombre: string) => Promise<string | undefined>
  onDelete: (idOrigen: string) => Promise<string | undefined>
  onImported: () => Promise<void>
}

export function RecordTab({ albaranes, onManualEntry, onRename, onDelete, onImported }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ImportDeliveryNotes albaranes={albaranes} onRename={onRename} onDelete={onDelete} onImported={onImported} />
        <ManualEntry onCreated={onManualEntry} />
      </div>
    </div>
  )
}
