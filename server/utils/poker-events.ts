type Listener = () => void

// This process is the only Nitro instance. Keep listeners scoped to project/session,
// not to requests, and release every subscription when its SSE connection closes.
const listenersByProject = new Map<string, Map<string, Set<Listener>>>()

export function subscribePokerSession(
  projectId: string,
  sessionId: string,
  listener: Listener,
): () => void {
  let sessions = listenersByProject.get(projectId)
  if (!sessions) {
    sessions = new Map()
    listenersByProject.set(projectId, sessions)
  }
  let listeners = sessions.get(sessionId)
  if (!listeners) {
    listeners = new Set()
    sessions.set(sessionId, listeners)
  }
  listeners.add(listener)

  let active = true
  return () => {
    if (!active) return
    active = false
    listeners.delete(listener)
    if (listeners.size === 0) sessions.delete(sessionId)
    if (sessions.size === 0) listenersByProject.delete(projectId)
  }
}

function notify(listeners: Set<Listener> | undefined) {
  if (!listeners) return
  // A listener should not prevent other clients from receiving a notification.
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch (cause) {
      console.error('Poker session notification failed', cause)
    }
  }
}

// Notify only the room whose committed data changed.
export function publishPokerSession(projectId: string, sessionId: string) {
  notify(listenersByProject.get(projectId)?.get(sessionId))
}

// Project membership and card-deck changes can affect multiple open rooms.
export function publishProjectPokerSessions(projectId: string) {
  const sessions = listenersByProject.get(projectId)
  if (!sessions) return
  for (const listeners of sessions.values()) notify(listeners)
}
