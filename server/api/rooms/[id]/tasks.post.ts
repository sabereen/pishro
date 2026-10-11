import { randomUUID } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { rooms, tasks } from '../../../database/schema'
import { getRoomSnapshot } from '../../../services/poker'
import { useDatabase } from '../../../utils/database'
import { requireParticipant, roomIdFromEvent } from '../../../utils/identity'
import { readText } from '../../../utils/input'

export default defineEventHandler(async (event) => {
  const roomId = roomIdFromEvent(event)
  const participant = await requireParticipant(event, roomId)
  if (!participant.isHost) throw createError({ statusCode: 403, message: 'فقط میزبان می‌تواند کار اضافه کند.' })
  const body: unknown = await readBody(event)
  const title = readText(body, 'title', 240)

  await useDatabase().transaction(async (tx) => {
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update')
    if (!room) throw createError({ statusCode: 404, message: 'جلسه پیدا نشد.' })
    const [last] = await tx.select({ position: tasks.position }).from(tasks).where(eq(tasks.roomId, roomId)).orderBy(desc(tasks.position)).limit(1)
    const position = (last?.position ?? -1) + 1
    if (position >= 100) throw createError({ statusCode: 409, message: 'هر جلسه حداکثر ۱۰۰ کار دارد.' })
    await tx.insert(tasks).values({ id: randomUUID(), roomId, title, position })
    if (room.finished) {
      await tx.update(rooms).set({ finished: false, revealed: false, activePosition: position, revision: room.revision + 1 }).where(eq(rooms.id, roomId))
    }
  })
  return getRoomSnapshot(roomId, participant.id)
})
