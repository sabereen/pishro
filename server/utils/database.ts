import { drizzle } from 'drizzle-orm/mysql2'
import { createPool } from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'
import * as schema from '../database/schema'

let database: ReturnType<typeof drizzle<typeof schema>> | undefined
let pool: Pool | undefined

export function useDatabase() {
  if (database) return database

  const { databaseUrl } = useRuntimeConfig()
  if (!databaseUrl) {
    throw createError({ statusCode: 503, message: 'سرویس فعلاً در دسترس نیست. کمی بعد دوباره تلاش کنید.' })
  }

  pool = createPool({
    uri: databaseUrl,
    connectionLimit: 10,
    timezone: 'Z',
    charset: 'utf8mb4',
    enableKeepAlive: true,
  })
  database = drizzle(pool, { schema, mode: 'default' })
  return database
}

export async function closeDatabase() {
  const activePool = pool
  pool = undefined
  database = undefined
  await activePool?.end()
}
