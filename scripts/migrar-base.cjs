// Migra una base de datos con la estructura antigua (tablas ventas y cedidos) a la actual (todo en boletos).
// No modifica la base original: trabaja sobre una copia y comprueba que los totales coinciden.
//
// Uso: pnpm db:migrar -- "C:\ruta\antigua.db" ["C:\ruta\nueva.db"]
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')

function fail(message) {
  console.error(message)
  process.exit(1)
}

const [sourceArg, targetArg] = process.argv.slice(2)
if (!sourceArg) fail('Uso: pnpm db:migrar -- "<base antigua .db>" ["<base nueva .db>"]')

const source = path.resolve(sourceArg)
if (!fs.existsSync(source)) fail(`No existe el archivo: ${source}`)
const header = Buffer.alloc(16)
const fd = fs.openSync(source, 'r')
fs.readSync(fd, header, 0, 16, 0)
fs.closeSync(fd)
if (header.toString() !== 'SQLite format 3\u0000') fail('El archivo no parece una base de datos SQLite.')

const extension = path.extname(source) || '.db'
const target = path.resolve(targetArg ?? path.join(path.dirname(source), `${path.basename(source, path.extname(source))}.migrada${extension}`))
if (target.toLowerCase() === source.toLowerCase()) fail('El destino no puede ser la base original: la original nunca se modifica.')
if (fs.existsSync(target)) fail(`Ya existe ${target}. Elige otro destino o bórralo antes.`)

let sqlite = null
try {
  sqlite = require('node:sqlite')
} catch {
  // Sin node:sqlite (Node < 22.5) se migra igualmente, pero sin comprobación de totales.
}

function summarize(file) {
  if (!sqlite) return null
  const db = new sqlite.DatabaseSync(file, { readOnly: true })
  try {
    const one = (sql) => Object.values(db.prepare(sql).get())[0]
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
    if (tables.includes('ventas')) {
      return {
        antigua: true,
        boletos: one('SELECT COUNT(*) FROM boletos'),
        vendidos: one("SELECT COUNT(*) FROM ventas WHERE estado = 'activa'"),
        anuladas: one("SELECT COUNT(*) FROM ventas WHERE estado <> 'activa'"),
        cedidos: tables.includes('cedidos')
          ? one('SELECT COUNT(*) FROM (SELECT 1 FROM cedidos GROUP BY id_sorteo, numero_jugado, serie, fraccion)')
          : 0,
      }
    }
    return {
      antigua: false,
      boletos: one('SELECT COUNT(*) FROM boletos'),
      vendidos: one("SELECT COUNT(*) FROM boletos WHERE estado = 'vendido'"),
      anuladas: one("SELECT COUNT(*) FROM boletos WHERE estado <> 'vendido' AND fecha_hora_anulacion IS NOT NULL"),
      cedidos: one("SELECT COUNT(*) FROM boletos WHERE estado = 'cedido'"),
      sinOrigen: one('SELECT COUNT(*) FROM boletos WHERE id_origen IS NULL'),
    }
  } finally {
    db.close()
  }
}

const before = summarize(source)
if (before && !before.antigua) {
  console.log('La base ya tiene la estructura actual: no hace falta migrarla.')
  process.exit(0)
}

fs.copyFileSync(source, target)
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js')
const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: root,
  env: { ...process.env, DATABASE_URL: `file:${target.replaceAll('\\', '/')}` },
  encoding: 'utf8',
})
if (result.status !== 0) {
  fs.rmSync(target, { force: true })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  console.error(output.trim().split(/\r?\n/).filter(Boolean).slice(-8).join('\n'))
  if (output.includes('ABORTADO_hay_boletos_vendidos_y_cedidos')) {
    console.error('\nHay boletos vendidos y cedidos a la vez, o cedidos por varios albaranes. Resuélvelo en la base original con')
    console.error('la versión anterior de la aplicación (anula la venta o elimina el albarán de cesión que sobra) y repite la migración.')
    console.error('Las consultas para localizar los conflictos están al principio de la migración 20260930130000_fusionar_boletos_ventas_cedidos.')
  }
  fail('\nLa migración ha fallado. La base original no se ha modificado y no se ha creado ninguna copia.')
}

console.log(`Base migrada: ${target}`)
const after = summarize(target)
if (before && after) {
  const rows = [
    ['Boletos', before.boletos, after.boletos],
    ['Ventas activas → vendidos', before.vendidos, after.vendidos],
    ['Cedidos (por boleto)', before.cedidos, after.cedidos],
  ]
  for (const [label, was, now] of rows) console.log(`  ${label.padEnd(28)} antes ${String(was).padStart(7)}   después ${String(now).padStart(7)}   ${was === now ? 'OK' : was < now ? 'REVISAR (más que antes)' : 'REVISAR (menos que antes)'}`)
  console.log(`  Ventas anuladas conservadas: ${before.anuladas} → ${after.anuladas}`)
  console.log(`  Boletos aún sin recibir (sin origen): ${after.sinOrigen}`)
  console.log('  («Boletos» puede aumentar si había cedidos de boletos que aún no se habían recibido: se crean sin origen.)')
}
console.log('\nSiguiente paso: abre la aplicación apuntando a la base migrada o impórtala desde Registro.')
