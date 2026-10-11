import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { PokerSnapshot } from '../../shared/models'
import { estimateHistory, pokerParticipants, pokerSessions, pokerSessionTasks, pokerVotes, projectMembers, users, workItems } from '../database/scrum'
import { requireProject } from '../utils/auth'
import { useDatabase } from '../utils/database'
import { jsonValue } from '../utils/json'
import { enumInput, integerInput, uuidInput } from '../utils/validation'
import { lockProject, selectedTasks, updateTask } from './projects'

export async function requirePoker(event: H3Event) {
  const context = await requireProject(event)
  const sessionId = uuidInput(getRouterParam(event, 'sessionId'))
  const [session] = await useDatabase().select().from(pokerSessions)
    .where(and(eq(pokerSessions.id, sessionId), eq(pokerSessions.projectId, context.projectId)))
  const [participant] = await useDatabase().select({ id: pokerParticipants.id }).from(pokerParticipants)
    .where(and(eq(pokerParticipants.sessionId, sessionId), eq(pokerParticipants.userId, context.user.id)))
  if (!session || !participant) throw createError({ statusCode: 403, message: 'به این جلسه دعوت نشده‌اید.' })
  return { ...context, sessionId, session }
}

export async function pokerSnapshot(sessionId: string, userId: string): Promise<PokerSnapshot> {
  return useDatabase().transaction(async (tx) => {
    const [session] = await tx.select().from(pokerSessions).where(eq(pokerSessions.id, sessionId))
    if (!session) throw createError({ statusCode: 404, message: 'جلسه پیدا نشد.' })
    const members = await tx.select({ userId: projectMembers.userId }).from(projectMembers)
      .where(eq(projectMembers.projectId, session.projectId))
    const memberIds = new Set(members.map((member) => member.userId))
    if (!memberIds.has(userId)) throw createError({ statusCode: 403, message: 'دسترسی شما به پروژه پایان یافته است.' })
    const people = await tx.select({ id: users.id, name: users.name, joinedAt: pokerParticipants.joinedAt, lastSeenAt: pokerParticipants.lastSeenAt })
      .from(pokerParticipants).innerJoin(users, eq(pokerParticipants.userId, users.id)).where(eq(pokerParticipants.sessionId, sessionId))
    if (!people.some((person) => person.id === userId)) throw createError({ statusCode: 403, message: 'به این جلسه دعوت نشده‌اید.' })
    const items = await tx.select({ item: pokerSessionTasks, title: workItems.title }).from(pokerSessionTasks)
      .innerJoin(workItems, eq(pokerSessionTasks.taskId, workItems.id))
      .where(eq(pokerSessionTasks.sessionId, sessionId)).orderBy(asc(pokerSessionTasks.position))
    const ids = items.map(({ item }) => item.id)
    const votes = ids.length ? await tx.select().from(pokerVotes).where(inArray(pokerVotes.sessionTaskId, ids)) : []
    const history = ids.length ? await tx.select().from(estimateHistory).where(inArray(estimateHistory.sessionTaskId, ids)).orderBy(asc(estimateHistory.createdAt)) : []
    const current = items.find(({ item }) => item.position === session.activePosition)?.item
    const currentVotes = current ? votes.filter((vote) => vote.sessionTaskId === current.id && vote.round === current.round) : []
    const voteOf = (id: string) => currentVotes.find((vote) => vote.userId === id)?.value ?? null
    return {
      session: jsonValue(session),
      me: { id: userId, facilitator: session.facilitatorId === userId, vote: voteOf(userId) },
      participants: people.filter((person) => memberIds.has(person.id)).map((person) => ({
        id: person.id, name: person.name, joined: Boolean(person.joinedAt),
        online: Boolean(person.lastSeenAt && Date.now() - person.lastSeenAt.getTime() < 25000),
        hasVoted: voteOf(person.id) !== null,
        vote: session.status === 'reveal' || session.status === 'review' || session.status === 'finalized' ? voteOf(person.id) : null,
      })),
      tasks: items.map(({ item, title }) => ({
        id: item.id, taskId: item.taskId, title, position: item.position, status: item.status, finalPoint: item.finalPoint, round: item.round,
        votes: votes.filter((vote) => vote.sessionTaskId === item.id &&
          (item.status === 'estimated' || session.status === 'reveal' || vote.round < item.round))
          .map((vote) => ({ userId: vote.userId, name: people.find((person) => person.id === vote.userId)?.name ?? 'عضو پیشین', value: vote.value, round: vote.round })),
        history: history.filter((entry) => entry.sessionTaskId === item.id).map((entry) => ({ point: entry.point, previousPoint: entry.previousPoint, reason: entry.reason, date: entry.createdAt.toISOString() })),
      })),
    }
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' })
}

export async function planningAction(context: Awaited<ReturnType<typeof requirePoker>>, body: Record<string, unknown>) {
  const action = enumInput(body.action, ['publish', 'start', 'vote', 'reveal', 'revote', 'accept', 'calibrate', 'finalize'] as const)
  const revision = integerInput(body.revision, 0, 2147483647)
  await useDatabase().transaction(async (tx) => {
    await lockProject(tx, context.projectId, context.user.id)
    const [session] = await tx.select().from(pokerSessions).where(eq(pokerSessions.id, context.sessionId)).for('update')
    if (!session || session.revision !== revision || session.status === 'finalized') {
      throw createError({ statusCode: 409, message: 'وضعیت جلسه تغییر کرده است؛ دوباره تلاش کنید.' })
    }
    const items = await tx.select().from(pokerSessionTasks).where(eq(pokerSessionTasks.sessionId, session.id)).orderBy(asc(pokerSessionTasks.position))
    const current = items.find((item) => item.position === session.activePosition)
    if (action === 'vote') {
      if (session.status !== 'voting' || !current || body.taskId !== current.id || typeof body.value !== 'string' || !session.cards.includes(body.value)) {
        throw createError({ statusCode: 409, message: 'رأی‌گیری این کار باز نیست یا کارت معتبر نیست.' })
      }
      await tx.insert(pokerVotes).values({ id: randomUUID(), sessionTaskId: current.id, userId: context.user.id, round: current.round, value: body.value })
        .onDuplicateKeyUpdate({ set: { value: body.value } })
      return
    }
    if (session.facilitatorId !== context.user.id) throw createError({ statusCode: 403, message: 'فقط تسهیل‌گر می‌تواند جلسه را مدیریت کند.' })
    const next: Partial<typeof pokerSessions.$inferInsert> = { revision: session.revision + 1 }
    if (action === 'publish' && session.status === 'draft') next.status = 'lobby'
    else if (action === 'start' && session.status === 'lobby') next.status = 'voting'
    else if (action === 'reveal' && session.status === 'voting') next.status = 'reveal'
    else if (action === 'revote' && (session.status === 'reveal' || session.status === 'review')) {
      const item = items.find((entry) => entry.id === body.taskId)
      if (!item || (session.status === 'reveal' && item.id !== current?.id)) throw createError({ statusCode: 400, message: 'کار انتخاب‌شده معتبر نیست.' })
      await tx.update(pokerSessionTasks).set({ round: item.round + 1, status: 'active' }).where(eq(pokerSessionTasks.id, item.id))
      next.status = 'voting'
      next.activePosition = item.position
    } else if ((action === 'accept' && session.status === 'reveal') || (action === 'calibrate' && session.status === 'review')) {
      const item = action === 'accept' ? current : items.find((entry) => entry.id === body.taskId)
      if (!item) throw createError({ statusCode: 400, message: 'کار پیدا نشد.' })
      if (action === 'accept' && body.taskId !== item.id) throw createError({ statusCode: 409, message: 'کار فعال تغییر کرده است.' })
      const point = integerInput(body.point, 0, 100)
      const [task] = await selectedTasks(tx, context.projectId, [item.taskId])
      if (!task) throw createError({ statusCode: 404, message: 'کار پیدا نشد.' })
      await updateTask(tx, task, { point })
      await tx.insert(estimateHistory).values({ id: randomUUID(), sessionTaskId: item.id, userId: context.user.id, previousPoint: task.point, point, reason: action === 'accept' ? 'accepted' : 'calibrated' })
      await tx.update(pokerSessionTasks).set({ finalPoint: point, status: 'estimated' }).where(eq(pokerSessionTasks.id, item.id))
      if (action === 'accept') {
        const pending = items.find((entry) => entry.id !== item.id && entry.status !== 'estimated')
        next.status = pending ? 'voting' : 'review'
        if (pending) {
          next.activePosition = pending.position
          await tx.update(pokerSessionTasks).set({ status: 'active' }).where(eq(pokerSessionTasks.id, pending.id))
        }
      }
    } else if (action === 'finalize' && session.status === 'review' && items.every((item) => item.status === 'estimated')) next.status = 'finalized'
    else throw createError({ statusCode: 409, message: 'این عملیات در مرحله فعلی جلسه مجاز نیست.' })
    await tx.update(pokerSessions).set(next).where(eq(pokerSessions.id, session.id))
  })
  return pokerSnapshot(context.sessionId, context.user.id)
}
