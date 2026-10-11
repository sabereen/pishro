import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { authSessions, projectMembers, users } from '../database/scrum'
import { useDatabase } from './database'
import { uuidInput } from './validation'

function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex')
  const key = await derive(password, salt)
  return `scrypt:32768:8:3:${salt}:${key.toString('hex')}`
}

export async function checkPassword(password: string, stored: string) {
  const [algorithm, n, r, p, salt, encoded] = stored.split(':')
  if (algorithm !== 'scrypt' || n !== '32768' || r !== '8' || p !== '3' || !salt || !encoded) return false
  const expected = Buffer.from(encoded, 'hex')
  const key = await derive(password, salt)
  return expected.length === key.length && timingSafeEqual(key, expected)
}

export async function startSession(event: H3Event, userId: string) {
  const token = randomBytes(32).toString('hex')
  const previous = getCookie(event, 'pishro_session')
  if (previous) await useDatabase().delete(authSessions).where(eq(authSessions.tokenHash, hashToken(previous)))
  await useDatabase().insert(authSessions).values({
    id: randomUUID(), userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 86400000),
  })
  setCookie(event, 'pishro_session', token, {
    httpOnly: true, sameSite: 'lax', secure: !import.meta.dev, path: '/', maxAge: 30 * 86400,
  })
}

export async function currentUser(event: H3Event) {
  const token = getCookie(event, 'pishro_session')
  if (!token || token.length !== 64) return null
  const [user] = await useDatabase().select({ id: users.id, name: users.name, email: users.email })
    .from(authSessions).innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.tokenHash, hashToken(token)), gt(authSessions.expiresAt, new Date()))).limit(1)
  return user ?? null
}

export async function requireUser(event: H3Event) {
  const user = await currentUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'برای ادامه وارد حساب خود شوید.' })
  return user
}

export async function requireProject(event: H3Event, admin = false) {
  const user = await requireUser(event)
  const projectId = uuidInput(getRouterParam(event, 'projectId'))
  const [membership] = await useDatabase().select().from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id))).limit(1)
  if (!membership || (admin && membership.role !== 'admin')) {
    throw createError({ statusCode: 403, message: 'به این بخش دسترسی ندارید.' })
  }
  return { user, projectId, membership }
}
