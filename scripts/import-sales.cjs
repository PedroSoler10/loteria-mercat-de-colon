const fs = require('node:fs')
const path = require('node:path')
const { mkdirSync } = require('node:fs')
const { PrismaClient } = require('@prisma/client')

function temporaryOriginId(prefix, date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${prefix}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

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

        const boleto = await tx.boleto.findFirst({
          where: {
            idSorteo: sorteo.idSorteo,
            numeroJugado: sale.numeroJugado,
            serie: sale.serie,
            fraccion: sale.fraccion,
          },
          include: { cedidos: true },
        })
        let target = boleto
        if (!target) {
          let originDate = sale.fechaHora
          let idOrigen = temporaryOriginId('VENT', originDate)
          while (await tx.origen.findUnique({ where: { idOrigen } })) {
            originDate = new Date(originDate.getTime() + 1000)
            idOrigen = temporaryOriginId('VENT', originDate)
          }
          await tx.origen.create({
            data: {
              idOrigen,
              idSorteo: sorteo.idSorteo,
              tipoOrigen: 'Venta importada',
              nombreAlbaran: `Venta ${sale.codigo}`,
              fechaHoraCarga: sale.fechaHora,
              fechaEmision: sale.fechaHora,
              totalNumeros: 1,
              totalSeries: 1,
              totalBilletes: 1,
            },
          })
          target = await tx.boleto.create({
            data: {
              idBoleto: `${sorteo.idSorteo}-${sale.numeroJugado}-${sale.serie}-${sale.fraccion}`,
              idSorteo: sorteo.idSorteo,
              idOrigen,
              numeroJugado: sale.numeroJugado,
              serie: sale.serie,
              fraccion: sale.fraccion,
              digitosControl: sale.digitosControl,
              codigoBarrasRaw: sale.codigo,
            },
            include: { cedidos: true },
          })
        }
        if (target.cedidos.length > 0) throw new Error(`El boleto está cedido y no se puede vender: ${sale.codigo}`)

        const existing = await tx.venta.findUnique({ where: { idBoleto: target.idBoleto } })
        if (existing?.estado === 'activa') {
          skipped.push(sale.codigo)
          continue
        }

        const venta = existing
          ? await tx.venta.update({
              where: { idBoleto: target.idBoleto },
              data: { estado: 'activa', fechaHoraVenta: sale.fechaHora, fechaHoraAnulacion: null, motivoAnulacion: null },
            })
          : await tx.venta.create({
              data: { idBoleto: target.idBoleto, fechaHoraVenta: sale.fechaHora },
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
