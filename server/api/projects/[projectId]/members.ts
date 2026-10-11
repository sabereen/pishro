import { randomBytes, randomUUID } from 'node:crypto'
import { and, eq, ne } from 'drizzle-orm'
import { pokerParticipants, pokerSessions, projectInvites, projectMembers, users, workItems } from '../../../database/scrum'
import { lockProject } from '../../../services/projects'
import { hashToken, requireProject } from '../../../utils/auth'
import { useDatabase } from '../../../utils/database'
import { enumInput, objectBody, textInput, uuidInput } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { projectId, user } = await requireProject(event, true)
  const body = objectBody(await readBody<unknown>(event))
  return useDatabase().transaction(async (tx) => {
    await lockProject(tx, projectId, user.id, true)
    if (event.method === 'POST') {
      if (body.email) {
        const email = textInput(body.email, 254).toLowerCase()
        const [person] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email))
        if (!person) throw createError({ statusCode: 404, message: 'این کاربر هنوز ثبت‌نام نکرده؛ از لینک دعوت استفاده کنید.' })
        await tx.insert(projectMembers).values({ id: randomUUID(), projectId, userId: person.id }).onDuplicateKeyUpdate({ set: { userId: person.id } })
        return { ok: true }
      }
      const token = randomBytes(32).toString('hex')
      await tx.insert(projectInvites).values({ id: randomUUID(), projectId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 86400000) })
      return { token }
    }
    if (event.method !== 'PATCH' && event.method !== 'DELETE') {
      throw createError({ statusCode: 405, message: 'عملیات پشتیبانی نمی‌شود.' })
    }
    const userId = uuidInput(body.userId)
    const members = await tx.select().from(projectMembers).where(eq(projectMembers.projectId, projectId))
    const member = members.find((person) => person.userId === userId)
    if (!member) throw createError({ statusCode: 404, message: 'عضو پیدا نشد.' })
    const role = event.method === 'PATCH' ? enumInput(body.role, ['admin', 'member'] as const) : null
    if (member.role === 'admin' && role !== 'admin' && members.filter((person) => person.role === 'admin').length === 1) {
      throw createError({ statusCode: 409, message: 'پروژه باید حداقل یک مدیر داشته باشد.' })
    }
    if (role) await tx.update(projectMembers).set({ role }).where(eq(projectMembers.id, member.id))
    else {
      const successor = members.find((person) => person.userId !== userId && person.role === 'admin')
      const facilitated = await tx.select({ id: pokerSessions.id }).from(pokerSessions)
        .where(and(eq(pokerSessions.projectId, projectId), eq(pokerSessions.facilitatorId, userId), ne(pokerSessions.status, 'finalized'))).for('update')
      if (facilitated.length && !successor) throw createError({ statusCode: 409, message: 'ابتدا یک مدیر دیگر برای ادامه جلسه‌های پوکر تعیین کنید.' })
      if (successor) {
        for (const session of facilitated) {
          await tx.update(pokerSessions).set({ facilitatorId: successor.userId }).where(eq(pokerSessions.id, session.id))
          await tx.insert(pokerParticipants).values({ id: randomUUID(), sessionId: session.id, userId: successor.userId })
            .onDuplicateKeyUpdate({ set: { userId: successor.userId } })
        }
      }
      await tx.update(workItems).set({ assigneeId: null }).where(and(eq(workItems.projectId, projectId), eq(workItems.assigneeId, userId)))
      await tx.delete(projectMembers).where(eq(projectMembers.id, member.id))
    }
    return { ok: true }
  })
})
