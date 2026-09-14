import 'dotenv/config'
import path from 'path'
import { defineConfig, env } from 'prisma/config'

// Connection string comes from DATABASE_URL (.env); never hardcode credentials here.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
