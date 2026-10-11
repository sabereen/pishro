import { createHash, randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { participants } from '../database/schema'
import { useDatabase } from './database'

export function roomIdFromEvent(event: H3Event) {
  const id = getRouterParam(event, 'id')
  if (!id || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(id)) {
    throw createError({ statusCode: 404, message: 'جلسه پیدا نشد.' })
  }
  return id
}

export function createIdentity(event: H3Event, roomId: string) {
  const token = randomBytes(32).toString('hex')
  setCookie(event, `pishro_${roomId}`, token, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return createHash('sha256').update(token).digest('hex')
}

export async function findParticipant(event: H3Event, roomId: string) {
  const token = getCookie(event, `pishro_${roomId}`)
  if (!token) return null
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const [participant] = await useDatabase().select().from(participants).where(
    and(eq(participants.roomId, roomId), eq(participants.tokenHash, tokenHash)),
  ).limit(1)
  return participant ?? null
}

export async function requireParticipant(event: H3Event, roomId: string) {
  const participant = await findParticipant(event, roomId)
  if (!participant) {
    throw createError({ statusCode: 401, message: 'ابتدا به جلسه بپیوندید.' })
  }
  return participant
}
