import { and, eq, sql } from 'drizzle-orm'
import { pokerParticipants } from '../../../../../database/scrum'
import { pokerSnapshot, requirePoker } from '../../../../../services/planning'
import { requireUser } from '../../../../../utils/auth'
import { useDatabase } from '../../../../../utils/database'
import { subscribePokerSession } from '../../../../../utils/poker-events'

const HEARTBEAT_MS = 10_000
const SLOW_SNAPSHOT_MS = 1_000

export default defineEventHandler(async (event) => {
  const { projectId, sessionId, user } = await requirePoker(event)
  const stream = createEventStream(event)
  const db = useDatabase()
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  let closed = false
  let stopping = false
  let refreshing = false
  let pending = false
  let keepalivePending = false
  let heartbeatRunning = false
  let previous = ''
  let initialTimer: ReturnType<typeof setTimeout> | undefined
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined

  async function stop(cause: unknown) {
    if (closed || stopping) return
    stopping = true
    const status =
      cause && typeof cause === 'object' && 'statusCode' in cause ? cause.statusCode : null
    if (status === 401 || status === 403) {
      await stream.push({ event: 'access-ended', data: '{}' }).catch(() => {})
    } else {
      console.error('Poker SSE connection failed', { sessionId, cause })
    }
    await stream.close().catch(() => {})
  }

  // A single writer per stream prevents out-of-order snapshots. Notifications
  // arriving during a database read or a network write request another pass.
  async function flushSnapshots() {
    if (refreshing || closed || stopping) return
    refreshing = true
    try {
      while (pending && !closed && !stopping) {
        pending = false
        const keepalive = keepalivePending
        keepalivePending = false
        const startedAt = performance.now()
        const snapshot = JSON.stringify(await pokerSnapshot(sessionId, user.id))
        const elapsedMs = Math.round(performance.now() - startedAt)
        if (elapsedMs >= SLOW_SNAPSHOT_MS)
          console.warn('Slow Poker SSE snapshot', { sessionId, elapsedMs })
        if (closed || stopping) break
        if (snapshot !== previous) {
          await stream.push({ event: 'snapshot', data: snapshot })
          previous = snapshot
        } else if (keepalive) {
          await stream.push({ event: 'heartbeat', data: '{}' })
        }
      }
    } catch (cause) {
      await stop(cause)
    } finally {
      refreshing = false
      if (pending && !closed && !stopping) void flushSnapshots()
    }
  }

  function requestSnapshot(keepalive = false) {
    if (closed || stopping) return
    pending = true
    keepalivePending ||= keepalive
    if (!refreshing) void flushSnapshots()
  }

  // Presence and auth still need periodic maintenance. This is no longer a
  // one-second full-snapshot poll: changes are pushed immediately after commit.
  async function heartbeat() {
    if (heartbeatRunning || closed || stopping) return
    heartbeatRunning = true
    try {
      await requireUser(event)
      await db
        .update(pokerParticipants)
        .set({
          joinedAt: sql`coalesce(${pokerParticipants.joinedAt}, CURRENT_TIMESTAMP)`,
          lastSeenAt: new Date(),
        })
        .where(
          and(eq(pokerParticipants.sessionId, sessionId), eq(pokerParticipants.userId, user.id)),
        )
      requestSnapshot(true)
    } catch (cause) {
      await stop(cause)
    } finally {
      heartbeatRunning = false
    }
  }

  // Subscribe before taking the initial snapshot, so a concurrent commit
  // cannot be missed between the first read and listener registration.
  const unsubscribe = subscribePokerSession(projectId, sessionId, () => requestSnapshot())
  stream.onClosed(() => {
    closed = true
    clearTimeout(initialTimer)
    clearInterval(heartbeatTimer)
    unsubscribe()
  })
  heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_MS)
  initialTimer = setTimeout(() => void heartbeat(), 0)
  return stream.send()
})
