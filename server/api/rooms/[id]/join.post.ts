import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { participants, rooms } from '../../../database/schema'
import { getRoomSnapshot } from '../../../services/poker'
import { useDatabase } from '../../../utils/database'
import { createIdentity, findParticipant, roomIdFromEvent } from '../../../utils/identity'
import { readText } from '../../../utils/input'

export default defineEventHandler(async (event) => {
  const roomId = roomIdFromEvent(event)
  const body: unknown = await readBody(event)
  const name = readText(body, 'name', 60)
  const existing = await findParticipant(event, roomId)
  if (existing) return getRoomSnapshot(roomId, existing.id)

  const id = randomUUID()
  await useDatabase().transaction(async (tx) => {
    const [room] = await tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roomId)).for('update')
    if (!room) throw createError({ statusCode: 404, message: 'جلسه پیدا نشد.' })
    const people = await tx.select({ id: participants.id }).from(participants).where(eq(participants.roomId, roomId))
    if (people.length >= 50) throw createError({ statusCode: 409, message: 'ظرفیت جلسه (۵۰ نفر) تکمیل است.' })
    await tx.insert(participants).values({ id, roomId, name, tokenHash: createIdentity(event, roomId) })
  })
  return getRoomSnapshot(roomId, id)
})
