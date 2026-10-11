import { and, eq, sql } from 'drizzle-orm'
import { pokerParticipants } from '../../../../../database/scrum'
import { pokerSnapshot, requirePoker } from '../../../../../services/planning'
import { requireUser } from '../../../../../utils/auth'
import { useDatabase } from '../../../../../utils/database'

export default defineEventHandler(async (event) => {
  const { sessionId, user } = await requirePoker(event)
  const stream = createEventStream(event)
  const db = useDatabase()
  setResponseHeader(event, 'X-Accel-Buffering', 'no')
  let closed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let previous = ''
  let heartbeatAt = 0
  stream.onClosed(() => { closed = true; clearTimeout(timer) })

  async function tick() {
    if (closed) return
    try {
      const heartbeat = Date.now() - heartbeatAt >= 10000
      if (heartbeat) {
        await requireUser(event)
        const now = new Date()
        await db.update(pokerParticipants).set({ joinedAt: sql`coalesce(${pokerParticipants.joinedAt}, CURRENT_TIMESTAMP)`, lastSeenAt: now })
          .where(and(eq(pokerParticipants.sessionId, sessionId), eq(pokerParticipants.userId, user.id)))
        heartbeatAt = Date.now()
      }
      const snapshot = JSON.stringify(await pokerSnapshot(sessionId, user.id))
      if (closed) return
      if (snapshot !== previous) {
        await stream.push({ event: 'snapshot', data: snapshot })
        previous = snapshot
      } else if (heartbeat) await stream.push({ event: 'heartbeat', data: '{}' })
    } catch {
      if (!closed) await stream.close().catch(() => {})
      return
    }
    if (!closed) timer = setTimeout(() => { void tick() }, 1000)
  }
  timer = setTimeout(() => { void tick() }, 0)
  return stream.send()
})
