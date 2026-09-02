import { ImportAlbaranes } from './import-albaranes'
import { ManualEntry } from './manual-entry'
import { InventoryTreeTable } from './inventory-tree-table'
import { albaranes, type Ticket } from '@/lib/inventory-data'

type Props = { tickets: Ticket[] }

export function InventoryTab({ tickets }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ImportAlbaranes albaranes={albaranes} />
        <ManualEntry />
      </div>
      <InventoryTreeTable tickets={tickets} />
    </div>
  )
}
