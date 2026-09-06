import { ImportDeliveryNotes } from './import-delivery-notes'
import { ManualEntry } from './manual-entry'
import { albaranes } from '@/lib/record-data'

export function RecordTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ImportDeliveryNotes albaranes={albaranes} />
        <ManualEntry />
      </div>
    </div>
  )
}
