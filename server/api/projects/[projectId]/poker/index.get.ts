import { and, desc, eq } from 'drizzle-orm'
import { pokerParticipants, pokerSessions } from '../../../../database/scrum'
import { requireProject } from '../../../../utils/auth'
import { useDatabase } from '../../../../utils/database'

export default defineEventHandler(async (event) => {
  const { projectId, user } = await requireProject(event)
  return useDatabase().select({ id: pokerSessions.id, name: pokerSessions.name, status: pokerSessions.status, createdAt: pokerSessions.createdAt, invited: pokerParticipants.id })
    .from(pokerSessions).leftJoin(pokerParticipants, and(eq(pokerParticipants.sessionId, pokerSessions.id), eq(pokerParticipants.userId, user.id)))
    .where(eq(pokerSessions.projectId, projectId)).orderBy(desc(pokerSessions.createdAt))
})
