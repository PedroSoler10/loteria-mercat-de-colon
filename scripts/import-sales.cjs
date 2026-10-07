const fs = require('node:fs')
const path = require('node:path')
const { mkdirSync } = require('node:fs')
const { PrismaClient } = require('@prisma/client')

function configureDatabase() {
  if (!process.env.DATABASE_URL) {
    mkdirSync(path.join(process.cwd(), 'data'), { recursive: true })
    process.env.DATABASE_URL = 'file:../data/loteria.db'
  }
}

function parseBarcode(value) {
  const compact = value.trim().replace(/\s+/g, '')
  if (!/^\d{20}$/.test(compact)) {
    throw new Error(`El código SELAE no contiene 20 dígitos: ${value}`)
  }

  return {
    tipoJuego: Number(compact.slice(0, 1)),
    numeroSorteo: Number(compact.slice(1, 4)),
    anoEmision: Number(compact.slice(4, 5)),
    fraccion: compact.slice(5, 7),
    serie: compact.slice(7, 10),
    numeroJugado: compact.slice(11, 16),
    digitosControl: compact.slice(16, 20),
  }
}

function parseSalesText(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2 || !/^Código\s+Fecha\s+Hora$/i.test(lines[0])) {
    throw new Error('El archivo debe comenzar con la cabecera: Código Fecha Hora')
  }

  return lines.slice(1).map((line, index) => {
    const match = line.match(/^(\d{20})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}:\d{2})$/)
    if (!match) throw new Error(`Línea ${index + 2} no válida: ${line}`)
    const [, codigo, fecha, hora] = match
    const [day, month, year] = fecha.split('/').map(Number)
    const parsed = parseBarcode(codigo)
    const fechaHora = new Date(year, month - 1, day, ...hora.split(':').map(Number))
    if (Number.isNaN(fechaHora.getTime())) throw new Error(`Fecha no válida en la línea ${index + 2}: ${line}`)
    return { codigo, fechaHora, ...parsed }
  })
}

async function importSales(filePath) {
  configureDatabase()
  const prisma = new PrismaClient()
  try {
    const sales = parseSalesText(fs.readFileSync(filePath, 'utf8'))
    return await prisma.$transaction(async (tx) => {
      const created = []
      const skipped = []
      for (const sale of sales) {
        const sorteo = await tx.sorteo.findFirst({
          where: {
            tipoJuego: sale.tipoJuego,
            numeroSorteo: sale.numeroSorteo,
            anoEmision: sale.anoEmision,
          },
        })
        if (!sorteo) throw new Error(`No se encontró el sorteo del código ${sale.codigo}`)

        let target = await tx.boleto.findFirst({
          where: {
            idSorteo: sorteo.idSorteo,
            numeroJugado: sale.numeroJugado,
            serie: sale.serie,
            fraccion: sale.fraccion,
          },
        })
        if (!target) {
          // El albarán de entrada aún no está cargado: el boleto se crea sin origen y se recibirá después.
          target = await tx.boleto.create({
            data: {
              idBoleto: `${sorteo.idSorteo}-${sale.numeroJugado}-${sale.serie}-${sale.fraccion}`,
              idSorteo: sorteo.idSorteo,
              idOrigen: null,
              numeroJugado: sale.numeroJugado,
              serie: sale.serie,
              fraccion: sale.fraccion,
              digitosControl: sale.digitosControl,
              codigoBarrasRaw: sale.codigo,
            },
          })
        }
        if (target.estado === 'cedido') throw new Error(`El boleto está cedido y no se puede vender: ${sale.codigo}`)

        // El código leído trae los dígitos de control reales, que el albarán no incluye.
        const lectura = { digitosControl: sale.digitosControl, codigoBarrasRaw: sale.codigo }
        if (target.estado === 'vendido') {
          await tx.boleto.update({ where: { idBoleto: target.idBoleto }, data: lectura })
          skipped.push(sale.codigo)
          continue
        }

        const venta = await tx.boleto.update({
          where: { idBoleto: target.idBoleto },
          data: { estado: 'vendido', fechaHoraVenta: sale.fechaHora, fechaHoraAnulacion: null, motivoAnulacion: null, ...lectura },
        })
        created.push({ idBoleto: venta.idBoleto, codigo: sale.codigo, fechaHora: venta.fechaHoraVenta.toISOString() })
      }
      return { created, skipped }
    })
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Uso: node scripts/import-sales.cjs <archivo.txt>')
    process.exit(1)
  }
  importSales(path.resolve(filePath))
    .then(({ created, skipped }) => {
      console.log(`Ventas registradas: ${created.length}`)
      console.log(`Ventas ya registradas omitidas: ${skipped.length}`)
      for (const sale of created) console.log(`${sale.codigo} ${sale.fechaHora}`)
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}

module.exports = { importSales, parseSalesText }
