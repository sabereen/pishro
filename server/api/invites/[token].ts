import { randomUUID } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { projectInvites, projectMembers, projects } from '../../database/scrum'
import { hashToken, requireUser } from '../../utils/auth'
import { useDatabase } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const token = getRouterParam(event, 'token') ?? ''
  if (!/^[a-f\d]{64}$/.test(token)) throw createError({ statusCode: 404, message: 'دعوت معتبر نیست.' })
  const [invite] = await useDatabase().select({ projectId: projects.id, name: projects.name })
    .from(projectInvites).innerJoin(projects, eq(projectInvites.projectId, projects.id))
    .where(and(eq(projectInvites.tokenHash, hashToken(token)), gt(projectInvites.expiresAt, new Date())))
  if (!invite) throw createError({ statusCode: 404, message: 'لینک دعوت منقضی شده یا معتبر نیست.' })
  if (event.method === 'POST') {
    await useDatabase().insert(projectMembers).values({ id: randomUUID(), projectId: invite.projectId, userId: user.id })
      .onDuplicateKeyUpdate({ set: { userId: user.id } })
  } else if (event.method !== 'GET') throw createError({ statusCode: 405, message: 'عملیات پشتیبانی نمی‌شود.' })
  return invite
})
