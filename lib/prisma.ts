import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

if (!process.env.DATABASE_URL) {
  mkdirSync(path.join(process.cwd(), 'data'), { recursive: true })
  process.env.DATABASE_URL = 'file:../data/loteria.db'
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
