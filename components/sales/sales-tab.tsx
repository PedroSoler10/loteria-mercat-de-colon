'use client'

import { useMemo, useState } from 'react'
import { ArqueoPanel } from './arqueo-panel'
import { EditSaleDialog } from './edit-sale-dialog'
import { SalesTable } from './sales-table'
import { filterByPeriodo, type Periodo, type Sale } from '@/lib/sales-data'

type Props = {
  sales: Sale[]
  onEdit: (id: string, patch: Pick<Sale, 'fecha' | 'precio'>) => void
  onVoid: (sale: Sale) => void
}

export function SalesTab({ sales, onEdit, onVoid }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null)

  const periodSales = useMemo(() => filterByPeriodo(sales, periodo), [sales, periodo])
  const ingresos = useMemo(() => periodSales.reduce((total, sale) => total + sale.precio, 0), [periodSales])

  return (
    <div className="flex flex-col gap-5">
      <ArqueoPanel
        periodo={periodo}
        onPeriodoChange={setPeriodo}
        ingresos={ingresos}
        decimos={periodSales.length}
        operaciones={periodSales.length}
      />
      <SalesTable sales={periodSales} onEdit={setSaleToEdit} onVoid={onVoid} />
      <EditSaleDialog sale={saleToEdit} onClose={() => setSaleToEdit(null)} onSave={onEdit} />
    </div>
  )
}