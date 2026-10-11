import { eq } from 'drizzle-orm'
import { rooms } from '../../../database/schema'
import { getRoomSnapshot } from '../../../services/poker'
import { useDatabase } from '../../../utils/database'
import { findParticipant, roomIdFromEvent } from '../../../utils/identity'

export default defineEventHandler(async (event) => {
  const id = roomIdFromEvent(event)
  const [room] = await useDatabase().select({ id: rooms.id, name: rooms.name }).from(rooms).where(eq(rooms.id, id)).limit(1)
  if (!room) throw createError({ statusCode: 404, message: 'جلسه پیدا نشد.' })
  const participant = await findParticipant(event, id)
  if (!participant) return { joined: false as const, id: room.id, name: room.name }
  return { joined: true as const, room: await getRoomSnapshot(id, participant.id) }
})
