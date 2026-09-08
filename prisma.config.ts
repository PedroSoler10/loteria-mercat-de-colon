import { defineConfig } from 'prisma/config'

process.env.DATABASE_URL ??= 'file:../data/loteria.db'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.cjs',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
