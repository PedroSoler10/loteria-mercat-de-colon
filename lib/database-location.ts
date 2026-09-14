import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const defaultConfigDirectory = process.env.LOTERIA_CONFIG_DIR ?? path.join(process.cwd(), 'data')
const configPath = path.join(defaultConfigDirectory, 'database-location.json')

export function getDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl?.startsWith('file:')) return path.resolve(/* turbopackIgnore: true */ process.cwd(), databaseUrl.slice(5))
  return path.join(process.env.LOTERIA_DATA_DIR ?? defaultConfigDirectory, 'loteria.db')
}

export async function getConfiguredDatabasePath() {
  return getDatabasePath()
}

export async function isDatabaseConfigured() {
  try {
    const config = JSON.parse(await readFile(configPath, 'utf8')) as { databasePath?: unknown }
    if (typeof config.databasePath !== 'string' || path.resolve(config.databasePath) !== getDatabasePath()) return false
    await access(getDatabasePath())
    return true
  } catch {
    return false
  }
}

export async function configureDatabase(databasePath: string) {
  await mkdir(defaultConfigDirectory, { recursive: true })
  await writeFile(configPath, JSON.stringify({ databasePath: path.resolve(databasePath) }, null, 2), 'utf8')
}

export async function saveDatabaseCopy(destinationPath: string) {
  const sourcePath = getDatabasePath()
  const resolvedPath = path.resolve(destinationPath)
  if (sourcePath.toLowerCase() === resolvedPath.toLowerCase()) return resolvedPath
  await mkdir(path.dirname(resolvedPath), { recursive: true })
  await copyFile(sourcePath, resolvedPath)
  await mkdir(defaultConfigDirectory, { recursive: true })
  await writeFile(configPath, JSON.stringify({ databasePath: resolvedPath }, null, 2), 'utf8')
  return resolvedPath
}
