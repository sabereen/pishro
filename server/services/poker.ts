import { and, asc, eq } from 'drizzle-orm'
import type { RoomSnapshot } from '../../shared/poker'
import { participants, rooms, tasks, votes } from '../database/schema'
import { useDatabase } from '../utils/database'

export async function getRoomSnapshot(roomId: string, participantId: string): Promise<RoomSnapshot> {
  return useDatabase().transaction(async (tx) => {
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).limit(1)
    if (!room) throw createError({ statusCode: 404, message: 'جلسه پیدا نشد.' })

    const people = await tx.select({
      id: participants.id,
      name: participants.name,
      isHost: participants.isHost,
      lastSeenAt: participants.lastSeenAt,
    }).from(participants).where(eq(participants.roomId, roomId)).orderBy(asc(participants.createdAt), asc(participants.id))
    const me = people.find((person) => person.id === participantId)
    if (!me) throw createError({ statusCode: 401, message: 'ابتدا به جلسه بپیوندید.' })

    const roomTasks = await tx.select().from(tasks).where(eq(tasks.roomId, roomId)).orderBy(asc(tasks.position))
    const current = room.finished ? null : roomTasks.find((task) => task.position === room.activePosition) ?? null
    const roundVotes = current
      ? await tx.select({ participantId: votes.participantId, value: votes.value }).from(votes).where(
          and(eq(votes.roomId, roomId), eq(votes.taskId, current.id)),
        )
      : []
    const voteByParticipant = new Map(roundVotes.map((vote) => [vote.participantId, vote.value]))

    return {
      id: room.id,
      name: room.name,
      revealed: room.revealed,
      finished: room.finished,
      revision: room.revision,
      me: { id: me.id, name: me.name, isHost: me.isHost, vote: voteByParticipant.get(me.id) ?? null },
      participants: people.map((person) => ({
        id: person.id,
        name: person.name,
        isHost: person.isHost,
        online: Date.now() - person.lastSeenAt.getTime() < 25000,
        hasVoted: voteByParticipant.has(person.id),
        // Hidden votes never leave the server, even for the facilitator.
        vote: room.revealed ? voteByParticipant.get(person.id) ?? null : null,
      })),
      tasks: roomTasks.map((task) => ({
        id: task.id,
        title: task.title,
        position: task.position,
        status: room.finished || task.position < room.activePosition
          ? 'completed'
          : task.position === room.activePosition ? 'active' : 'pending',
      })),
      activeTask: current ? { id: current.id, title: current.title, position: current.position } : null,
    }
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' })
}
