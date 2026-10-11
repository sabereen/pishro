import { and, asc, eq, gt } from 'drizzle-orm'
import { rooms, tasks, votes } from '../../../database/schema'
import { getRoomSnapshot } from '../../../services/poker'
import { useDatabase } from '../../../utils/database'
import { requireParticipant, roomIdFromEvent } from '../../../utils/identity'
import { readRevision, readText } from '../../../utils/input'

export default defineEventHandler(async (event) => {
  const roomId = roomIdFromEvent(event)
  const participant = await requireParticipant(event, roomId)
  if (!participant.isHost) throw createError({ statusCode: 403, message: 'فقط میزبان می‌تواند دور را مدیریت کند.' })
  const body: unknown = await readBody(event)
  const action = readText(body, 'action', 10)
  const taskId = readText(body, 'taskId', 36)
  const revision = readRevision(body)
  if (!['reveal', 'reset', 'next'].includes(action)) {
    throw createError({ statusCode: 400, message: 'عملیات معتبر نیست.' })
  }

  await useDatabase().transaction(async (tx) => {
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update')
    if (!room) throw createError({ statusCode: 404, message: 'جلسه پیدا نشد.' })
    const [task] = await tx.select().from(tasks).where(
      and(eq(tasks.roomId, roomId), eq(tasks.position, room.activePosition)),
    )
    if (room.finished || !task || task.id !== taskId || room.revision !== revision) {
      throw createError({ statusCode: 409, message: 'کار فعال تغییر کرده است.' })
    }

    if (action === 'reveal') {
      await tx.update(rooms).set({ revealed: true, revision: room.revision + 1 }).where(eq(rooms.id, roomId))
    } else if (action === 'reset') {
      await tx.delete(votes).where(and(eq(votes.roomId, roomId), eq(votes.taskId, taskId)))
      await tx.update(rooms).set({ revealed: false, revision: room.revision + 1 }).where(eq(rooms.id, roomId))
    } else {
      if (!room.revealed) throw createError({ statusCode: 409, message: 'ابتدا کارت‌ها را نمایش دهید.' })
      const [nextTask] = await tx.select().from(tasks).where(
        and(eq(tasks.roomId, roomId), gt(tasks.position, room.activePosition)),
      ).orderBy(asc(tasks.position)).limit(1)
      await tx.update(rooms).set({
        activePosition: nextTask?.position ?? room.activePosition,
        revealed: false,
        finished: !nextTask,
        revision: room.revision + 1,
      }).where(eq(rooms.id, roomId))
    }
  })
  return getRoomSnapshot(roomId, participant.id)
})
