import { ventaEstado } from '@/lib/boleto-estado'
import { DEFAULT_TICKET_PRICE_CENTIMOS } from '@/lib/sorteos-config'

type BoletoConSorteo = {
  idBoleto: string
  idOrigen: string | null
  fechaHoraVenta: Date | null
  estado: string
  numeroJugado: string
  serie: string
  fraccion: string
  sorteo: { tipoJuego: number; nombreSorteo: string; anoCompleto: number; precioCentimos: number }
}

/** Una venta tal y como la ve la interfaz: es el boleto con su fecha de venta. */
export function toSale(boleto: BoletoConSorteo) {
  return {
    id: boleto.idBoleto,
    fecha: (boleto.fechaHoraVenta ?? new Date()).toISOString(),
    tipoJuego: String(boleto.sorteo.tipoJuego),
    sorteo: boleto.sorteo.nombreSorteo,
    anio: boleto.sorteo.anoCompleto,
    numero: boleto.numeroJugado,
    serie: boleto.serie,
    fraccion: boleto.fraccion,
    precio: (boleto.sorteo.precioCentimos || DEFAULT_TICKET_PRICE_CENTIMOS) / 100,
    estado: ventaEstado(boleto),
    sinAlbaran: boleto.idOrigen === null,
  }
}
