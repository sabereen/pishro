import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { voteValues } from '../../../../shared/poker'
import type { VoteValue } from '../../../../shared/poker'
import { rooms, tasks, votes } from '../../../database/schema'
import { getRoomSnapshot } from '../../../services/poker'
import { useDatabase } from '../../../utils/database'
import { requireParticipant, roomIdFromEvent } from '../../../utils/identity'
import { readRevision, readText } from '../../../utils/input'

export default defineEventHandler(async (event) => {
  const roomId = roomIdFromEvent(event)
  const participant = await requireParticipant(event, roomId)
  const body: unknown = await readBody(event)
  const taskId = readText(body, 'taskId', 36)
  const value = readText(body, 'value', 10)
  const revision = readRevision(body)
  if (!voteValues.includes(value as VoteValue)) {
    throw createError({ statusCode: 400, message: 'کارت انتخاب‌شده معتبر نیست.' })
  }

  await useDatabase().transaction(async (tx) => {
    // Serialize every round mutation on the room row to prevent vote/reveal races.
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update')
    if (!room) throw createError({ statusCode: 404, message: 'جلسه پیدا نشد.' })
    if (room.revealed || room.finished || room.revision !== revision) {
      throw createError({ statusCode: 409, message: 'رأی‌گیری این دور بسته شده است.' })
    }
    const [task] = await tx.select({ id: tasks.id }).from(tasks).where(
      and(eq(tasks.roomId, roomId), eq(tasks.position, room.activePosition)),
    )
    if (!task || task.id !== taskId) {
      throw createError({ statusCode: 409, message: 'کار فعال تغییر کرده است. دوباره تلاش کنید.' })
    }
    await tx.insert(votes).values({
      id: randomUUID(), roomId, taskId, participantId: participant.id, value: value as VoteValue,
    }).onDuplicateKeyUpdate({ set: { value: value as VoteValue, updatedAt: new Date() } })
  })
  return getRoomSnapshot(roomId, participant.id)
})
