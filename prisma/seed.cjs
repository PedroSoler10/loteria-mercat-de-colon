const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const drawId = '52026102'
const registeredAt = new Date('2026-08-28T09:14:00.000Z')

const origins = [
  { idOrigen: 'ALB-2026-00412', tipoOrigen: 'Albarán', nombreAlbaran: 'Navidad - Lote 1' },
  { idOrigen: 'ALB-2026-00418', tipoOrigen: 'Albarán', nombreAlbaran: 'Navidad - Lote 2' },
  { idOrigen: 'ALB-2026-00425', tipoOrigen: 'Albarán', nombreAlbaran: 'Reposición abonados' },
]

const batches = [
  { origin: 'ALB-2026-00412', numbers: ['04521', '17384', '29906', '48212'], series: ['001', '002', '003', '004', '005', '006'] },
  { origin: 'ALB-2026-00418', numbers: ['66057', '75318'], series: ['050', '051', '052', '053', '054', '055'] },
  { origin: 'ALB-2026-00425', numbers: ['88890'], series: ['060', '061'] },
]

function createTickets() {
  const tickets = []
  for (const batch of batches) {
    for (const number of batch.numbers) {
      for (const series of batch.series) {
        for (let index = 1; index <= 10; index += 1) {
          const fraction = String(index).padStart(2, '0')
          tickets.push({
            idBoleto: `${drawId}-${number}-${series}-${fraction}`,
            idSorteo: drawId,
            idOrigen: batch.origin,
            numeroJugado: number,
            serie: series,
            fraccion: fraction,
            digitosControl: '0000',
            codigoBarrasRaw: `${drawId}${fraction}${series}${number}0000`,
            fechaHoraRegistro: registeredAt,
          })
        }
      }
    }
  }
  return tickets
}

async function main() {
  await prisma.venta.deleteMany()
  await prisma.boleto.deleteMany()
  await prisma.origen.deleteMany()
  await prisma.sorteo.deleteMany()

  await prisma.sorteo.create({
    data: {
      idSorteo: drawId,
      tipoJuego: 5,
      anoEmision: 6,
      anoCompleto: 2026,
      numeroSorteo: 102,
      nombreSorteo: 'Sorteo Extraordinario de Navidad',
      precioCentimos: 2000,
    },
  })

  await prisma.origen.createMany({ data: origins })
  await prisma.boleto.createMany({ data: createTickets() })

  console.log(`Base de datos inicializada: ${createTickets().length} boletos`) 
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
