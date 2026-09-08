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
  }
}

function parseSalesText(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2 || !/^Código\s+Fecha\s+Hora$/i.test(lines[0])) {
    throw new Error('El archivo debe comenzar con la cabecera: Código Fecha Hora')
  }

  return lines.slice(1).map((line, index) => {
    const match = line.match(/^(\d{20})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})$/)
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
        if (!boleto) throw new Error(`No se encontró el boleto del código ${sale.codigo}`)
        if (boleto.cedidos.length > 0) throw new Error(`El boleto está cedido y no se puede vender: ${sale.codigo}`)

        const existing = await tx.venta.findUnique({ where: { idBoleto: boleto.idBoleto } })
        if (existing?.estado === 'activa') throw new Error(`El boleto ya está vendido: ${sale.codigo}`)

        const venta = existing
          ? await tx.venta.update({
              where: { idBoleto: boleto.idBoleto },
              data: { estado: 'activa', fechaHoraVenta: sale.fechaHora, fechaHoraAnulacion: null, motivoAnulacion: null },
            })
          : await tx.venta.create({
              data: { idBoleto: boleto.idBoleto, fechaHoraVenta: sale.fechaHora },
            })
        created.push({ idBoleto: venta.idBoleto, codigo: sale.codigo, fechaHora: venta.fechaHoraVenta.toISOString() })
      }
      return created
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
    .then((created) => {
      console.log(`Ventas registradas: ${created.length}`)
      for (const sale of created) console.log(`${sale.codigo} ${sale.fechaHora}`)
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}

module.exports = { importSales, parseSalesText }
