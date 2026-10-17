import mysql from 'mysql2/promise'
import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'

async function main() {
  const url = process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL
  const directory = process.argv[2]
  if (!url || !directory) throw new Error('Database URL and migration directory are required')
  const client = await mysql.createConnection(url)
  try {
    await migrate(drizzle({ client }), { migrationsFolder: directory })
    console.info('Committed database migrations applied.')
  } finally {
    await client.end()
  }
}
main().catch(() => {
  console.error('Database migration failed. Inspect the private server deployment log.')
  process.exitCode = 1
})
