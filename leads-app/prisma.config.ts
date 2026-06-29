import path from 'path'
import { defineConfig } from 'prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: 'postgresql://leads_user:leads_password@localhost:5432/leads_db',
  },
  migrate: {
    async adapter() {
      return new PrismaPg({
        connectionString: 'postgresql://leads_user:leads_password@localhost:5432/leads_db',
      })
    },
  },
})
