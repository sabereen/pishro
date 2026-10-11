import { defineConfig } from 'drizzle-kit'

const url = process.env.NUXT_DATABASE_URL

if (!url) {
  throw new Error('Set NUXT_DATABASE_URL before running database migration commands.')
}

export default defineConfig({
  dialect: 'mysql',
  schema: './server/database/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
})
