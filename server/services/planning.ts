import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { PokerSnapshot } from '../../shared/models'
import {
  estimateHistory,
  pokerParticipants,
  pokerSessions,
  pokerSessionTasks,
  pokerVotes,
  projectMembers,
  users,
  workItems,
} from '../database/scrum'
import { requireProject } from '../utils/auth'
import { useDatabase } from '../utils/database'
import { gravatarUrl } from '../utils/avatar'
import { jsonValue } from '../utils/json'
import { enumInput, integerInput, pointInput, uuidInput } from '../utils/validation'
import { lockProject, selectedTasks, updateTask } from './projects'

export async function requirePoker(event: H3Event) {
  const context = await requireProject(event)
  const sessionId = uuidInput(getRouterParam(event, 'sessionId'))
  const [session] = await useDatabase()
    .select()
    .from(pokerSessions)
    .where(and(eq(pokerSessions.id, sessionId), eq(pokerSessions.projectId, context.projectId)))
  const [participant] = await useDatabase()
    .select({ id: pokerParticipants.id })
    .from(pokerParticipants)
    .where(
      and(
        eq(pokerParticipants.sessionId, sessionId),
        eq(pokerParticipants.userId, context.user.id),
      ),
    )
  if (!session || !participant)
    throw createError({ statusCode: 403, message: 'به این جلسه دعوت نشده‌اید.' })
  return { ...context, sessionId, session }
}

export async function pokerSnapshot(sessionId: string, userId: string): Promise<PokerSnapshot> {
  return useDatabase().transaction(
    async (tx) => {
      const [session] = await tx.select().from(pokerSessions).where(eq(pokerSessions.id, sessionId))
      if (!session) throw createError({ statusCode: 404, message: 'جلسه پیدا نشد.' })
      const members = await tx
        .select({ userId: projectMembers.userId, name: users.name, email: users.email })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, session.projectId))
      const memberIds = new Set(members.map((member) => member.userId))
      if (!memberIds.has(userId))
        throw createError({ statusCode: 403, message: 'دسترسی شما به پروژه پایان یافته است.' })
      const people = await tx
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          joinedAt: pokerParticipants.joinedAt,
          lastSeenAt: pokerParticipants.lastSeenAt,
        })
        .from(pokerParticipants)
        .innerJoin(users, eq(pokerParticipants.userId, users.id))
        .where(eq(pokerParticipants.sessionId, sessionId))
      if (!people.some((person) => person.id === userId))
        throw createError({ statusCode: 403, message: 'به این جلسه دعوت نشده‌اید.' })
      const items = await tx
        .select({ item: pokerSessionTasks, title: workItems.title })
        .from(pokerSessionTasks)
        .innerJoin(workItems, eq(pokerSessionTasks.taskId, workItems.id))
        .where(eq(pokerSessionTasks.sessionId, sessionId))
        .orderBy(asc(pokerSessionTasks.position))
      const ids = items.map(({ item }) => item.id)
      const votes = ids.length
        ? await tx.select().from(pokerVotes).where(inArray(pokerVotes.sessionTaskId, ids))
        : []
      const history = ids.length
        ? await tx
            .select()
            .from(estimateHistory)
            .where(inArray(estimateHistory.sessionTaskId, ids))
            .orderBy(asc(estimateHistory.createdAt))
        : []
      const current = items.find(({ item }) => item.position === session.activePosition)?.item
      const participantIds = new Set(
        people.filter((person) => memberIds.has(person.id)).map((person) => person.id),
      )
      const currentVotes = current
        ? votes.filter(
            (vote) =>
              vote.sessionTaskId === current.id &&
              vote.round === current.round &&
              participantIds.has(vote.userId) &&
              !current.ignoredUserIds.includes(vote.userId),
          )
        : []
      const ignored = new Set(current?.ignoredUserIds ?? [])
      const hiddenRounds = new Set(
        votes
          .filter(
            (vote) =>
              vote.value === '?' &&
              (vote.sessionTaskId !== current?.id ||
                vote.round !== current.round ||
                currentVotes.includes(vote)),
          )
          .map((vote) => `${vote.sessionTaskId}:${vote.round}`),
      )
      const visible = Boolean(
        current &&
        !current.revoteRequired &&
        !hiddenRounds.has(`${current.id}:${current.round}`) &&
        ['reveal', 'review', 'finalized'].includes(session.status),
      )
      const free = session.mode === 'free' ? session.freeRound : null
      const freeVotes = Object.entries(free?.votes ?? {}).filter(([id]) => participantIds.has(id))
      const voteOf = (id: string) =>
        free
          ? (free.votes[id] ?? null)
          : (currentVotes.find((vote) => vote.userId === id)?.value ?? null)
      const { freeRound: _privateRound, ...publicSession } = session
      return {
        session: jsonValue(publicSession),
        freeRound: free
          ? {
              round: free.round,
              votes:
                session.status === 'reveal'
                  ? freeVotes.map(([id, value]) => ({
                      userId: id,
                      name: people.find((person) => person.id === id)?.name ?? 'عضو پیشین',
                      value,
                      round: free.round,
                    }))
                  : [],
            }
          : null,
        availableMembers:
          session.facilitatorId === userId && session.status !== 'finalized'
            ? members
                .filter((member) => !participantIds.has(member.userId))
                .map((member) => ({
                  id: member.userId,
                  name: member.name,
                  avatarUrl: gravatarUrl(member.email),
                }))
            : [],
        me: { id: userId, facilitator: session.facilitatorId === userId, vote: voteOf(userId) },
        participants: people
          .filter((person) => memberIds.has(person.id))
          .map((person) => ({
            id: person.id,
            name: person.name,
            avatarUrl: gravatarUrl(person.email),
            joined: Boolean(person.joinedAt),
            online: Boolean(person.lastSeenAt && Date.now() - person.lastSeenAt.getTime() < 25000),
            ignored: ignored.has(person.id),
            hasVoted: voteOf(person.id) !== null,
            vote: (free ? session.status === 'reveal' : visible && !ignored.has(person.id))
              ? voteOf(person.id)
              : null,
          })),
        tasks: items.map(({ item, title }) => ({
          id: item.id,
          taskId: item.taskId,
          title,
          position: item.position,
          status: item.status,
          finalPoint: item.finalPoint,
          round: item.round,
          ignoredUserIds: item.ignoredUserIds,
          revoteRequired: Boolean(
            item.revoteRequired ||
            (item.id === current?.id &&
              session.status === 'reveal' &&
              hiddenRounds.has(`${item.id}:${item.round}`)),
          ),
          votes: votes
            .filter(
              (vote) =>
                vote.sessionTaskId === item.id &&
                !hiddenRounds.has(`${item.id}:${vote.round}`) &&
                (vote.round !== item.round ||
                  (!item.ignoredUserIds.includes(vote.userId) &&
                    (item.status === 'estimated' || participantIds.has(vote.userId)))) &&
                (item.status === 'estimated' ||
                  session.status === 'reveal' ||
                  vote.round < item.round),
            )
            .map((vote) => ({
              userId: vote.userId,
              name: people.find((person) => person.id === vote.userId)?.name ?? 'عضو پیشین',
              value: vote.value,
              round: vote.round,
            })),
          history: history
            .filter((entry) => entry.sessionTaskId === item.id)
            .map((entry) => ({
              point: entry.point,
              previousPoint: entry.previousPoint,
              reason: entry.reason,
              date: entry.createdAt.toISOString(),
            })),
        })),
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}

export async function planningAction(
  context: Awaited<ReturnType<typeof requirePoker>>,
  body: Record<string, unknown>,
) {
  const action = enumInput(body.action, [
    'addParticipant',
    'removeParticipant',
    'reset',
    'finish',
    'publish',
    'start',
    'vote',
    'ignore',
    'revote',
    'accept',
    'calibrate',
    'finalize',
  ] as const)
  const revision = integerInput(body.revision, 0, 2147483647)
  await useDatabase().transaction(async (tx) => {
    const project = await lockProject(tx, context.projectId, context.user.id)
    const [session] = await tx
      .select()
      .from(pokerSessions)
      .where(eq(pokerSessions.id, context.sessionId))
      .for('update')
    if (!session || session.revision !== revision || session.status === 'finalized') {
      throw createError({ statusCode: 409, message: 'وضعیت جلسه تغییر کرده است؛ دوباره تلاش کنید.' })
    }
    // Recheck invitation under the same locks as voting and membership edits.
    const participants = await tx
      .select({ userId: pokerParticipants.userId })
      .from(pokerParticipants)
      .innerJoin(
        projectMembers,
        and(
          eq(projectMembers.userId, pokerParticipants.userId),
          eq(projectMembers.projectId, session.projectId),
        ),
      )
      .where(eq(pokerParticipants.sessionId, session.id))
    if (!participants.some((person) => person.userId === context.user.id))
      throw createError({ statusCode: 403, message: 'دسترسی شما به این جلسه پایان یافته است.' })
    const managing = session.facilitatorId === context.user.id
    if (action !== 'vote' && !managing)
      throw createError({ statusCode: 403, message: 'فقط تسهیل‌گر می‌تواند جلسه را مدیریت کند.' })
    const membershipAction = action === 'addParticipant' || action === 'removeParticipant'
    let changedUserId: string | undefined
    if (membershipAction) {
      const userId = uuidInput(body.userId)
      changedUserId = userId
      const included = participants.some((person) => person.userId === userId)
      if (action === 'addParticipant') {
        const [member] = await tx
          .select({ id: projectMembers.id })
          .from(projectMembers)
          .where(
            and(eq(projectMembers.projectId, session.projectId), eq(projectMembers.userId, userId)),
          )
        if (!member)
          throw createError({ statusCode: 400, message: 'شرکت‌کننده باید عضو پروژه باشد.' })
        if (included) throw createError({ statusCode: 409, message: 'این فرد در جلسه حضور دارد.' })
        if (participants.length >= 50)
          throw createError({ statusCode: 400, message: 'هر جلسه حداکثر ۵۰ شرکت‌کننده دارد.' })
        await tx
          .insert(pokerParticipants)
          .values({ id: randomUUID(), sessionId: session.id, userId })
          .onDuplicateKeyUpdate({ set: { joinedAt: null, lastSeenAt: null } })
        participants.push({ userId })
      } else {
        if (userId === session.facilitatorId)
          throw createError({ statusCode: 400, message: 'تسهیل‌گر باید در جلسه بماند.' })
        if (!included) throw createError({ statusCode: 409, message: 'این فرد دیگر در جلسه نیست.' })
        await tx
          .delete(pokerParticipants)
          .where(
            and(eq(pokerParticipants.sessionId, session.id), eq(pokerParticipants.userId, userId)),
          )
        participants.splice(
          participants.findIndex((person) => person.userId === userId),
          1,
        )
      }
    }
    if (session.mode === 'free') {
      const round = session.freeRound ?? { round: 1, votes: {} }
      round.votes = Object.fromEntries(
        Object.entries(round.votes).filter(([id]) =>
          participants.some((person) => person.userId === id),
        ),
      )
      let status: typeof pokerSessions.$inferSelect.status = session.status
      if (action === 'publish' && status === 'draft') status = 'lobby'
      else if (action === 'start' && status === 'lobby') status = 'voting'
      else if (
        action === 'vote' &&
        status === 'voting' &&
        body.round === round.round &&
        typeof body.value === 'string' &&
        session.cards.includes(body.value)
      )
        round.votes[context.user.id] = body.value
      else if (action === 'reset' && (status === 'voting' || status === 'reveal')) {
        round.round += 1
        round.votes = {}
        status = 'voting'
      } else if (action === 'finish') {
        round.votes = {}
        status = 'finalized'
      } else if (!membershipAction)
        throw createError({ statusCode: 409, message: 'این عملیات در مرحله فعلی جلسه مجاز نیست.' })
      if (
        status === 'voting' &&
        participants.every((person) => round.votes[person.userId] !== undefined)
      )
        status = 'reveal'
      await tx
        .update(pokerSessions)
        .set({
          freeRound: status === 'finalized' ? null : round,
          status,
          revision:
            action === 'vote' && status === 'voting' ? session.revision : session.revision + 1,
          ...(action === 'start' ? { cards: project.settings.cards } : {}),
        })
        .where(eq(pokerSessions.id, session.id))
      return
    }
    const items = await tx
      .select()
      .from(pokerSessionTasks)
      .where(eq(pokerSessionTasks.sessionId, session.id))
      .orderBy(asc(pokerSessionTasks.position))
    const current = items.find((item) => item.position === session.activePosition)
    const completeRound = async () => {
      if (!current) return
      const votes = await tx
        .select()
        .from(pokerVotes)
        .where(and(eq(pokerVotes.sessionTaskId, current.id), eq(pokerVotes.round, current.round)))
      const required = participants.filter(
        (person) => !current.ignoredUserIds.includes(person.userId),
      )
      if (required.some((person) => !votes.some((vote) => vote.userId === person.userId))) return
      const uncertain = votes.some(
        (vote) => vote.value === '?' && required.some((person) => person.userId === vote.userId),
      )
      await tx
        .update(pokerSessionTasks)
        .set({ revoteRequired: uncertain ? 1 : 0 })
        .where(eq(pokerSessionTasks.id, current.id))
      await tx
        .update(pokerSessions)
        .set({ status: 'reveal', revision: session.revision + 1 })
        .where(eq(pokerSessions.id, session.id))
    }
    if (membershipAction && changedUserId) {
      if (current && session.status === 'voting' && action === 'addParticipant') {
        current.ignoredUserIds = current.ignoredUserIds.filter((id) => id !== changedUserId)
        await tx
          .update(pokerSessionTasks)
          .set({ ignoredUserIds: current.ignoredUserIds })
          .where(eq(pokerSessionTasks.id, current.id))
      }
      if (
        current &&
        (session.status === 'voting' || session.status === 'reveal') &&
        (action === 'removeParticipant' ||
          (action === 'addParticipant' && session.status === 'reveal')) &&
        !current.ignoredUserIds.includes(changedUserId)
      ) {
        current.ignoredUserIds = [...current.ignoredUserIds, changedUserId]
        await tx
          .update(pokerSessionTasks)
          .set({ ignoredUserIds: current.ignoredUserIds })
          .where(eq(pokerSessionTasks.id, current.id))
      }
      await tx
        .update(pokerSessions)
        .set({ revision: session.revision + 1 })
        .where(eq(pokerSessions.id, session.id))
      if (
        session.status === 'voting' ||
        (session.status === 'reveal' && action === 'removeParticipant')
      )
        await completeRound()
      return
    }
    if (action === 'vote') {
      if (
        session.status !== 'voting' ||
        !current ||
        current.ignoredUserIds.includes(context.user.id) ||
        body.taskId !== current.id ||
        (body.round !== undefined && body.round !== current.round) ||
        typeof body.value !== 'string' ||
        !session.cards.includes(body.value)
      ) {
        throw createError({
          statusCode: 409,
          message: 'رأی‌گیری این کار باز نیست یا کارت معتبر نیست.',
        })
      }
      await tx
        .insert(pokerVotes)
        .values({
          id: randomUUID(),
          sessionTaskId: current.id,
          userId: context.user.id,
          round: current.round,
          value: body.value,
        })
        .onDuplicateKeyUpdate({ set: { value: body.value } })
      await completeRound()
      return
    }
    if (session.facilitatorId !== context.user.id)
      throw createError({ statusCode: 403, message: 'فقط تسهیل‌گر می‌تواند جلسه را مدیریت کند.' })
    if (action === 'ignore') {
      const userId = uuidInput(body.userId)
      if (
        session.status !== 'voting' ||
        !current ||
        body.taskId !== current.id ||
        current.ignoredUserIds.includes(userId)
      ) {
        throw createError({ statusCode: 409, message: 'این فرد دیگر در انتظار رأی نیست.' })
      }
      const [participant] = await tx
        .select()
        .from(pokerParticipants)
        .where(
          and(eq(pokerParticipants.sessionId, session.id), eq(pokerParticipants.userId, userId)),
        )
      const [member] = await tx
        .select()
        .from(projectMembers)
        .where(
          and(eq(projectMembers.projectId, session.projectId), eq(projectMembers.userId, userId)),
        )
      const [vote] = await tx
        .select()
        .from(pokerVotes)
        .where(
          and(
            eq(pokerVotes.sessionTaskId, current.id),
            eq(pokerVotes.round, current.round),
            eq(pokerVotes.userId, userId),
          ),
        )
      if (!participant || !member || vote)
        throw createError({
          statusCode: 409,
          message: 'فقط فرد دعوت‌شده‌ای که هنوز رأی نداده قابل چشم‌پوشی است.',
        })
      current.ignoredUserIds = [...current.ignoredUserIds, userId]
      await tx
        .update(pokerSessionTasks)
        .set({ ignoredUserIds: current.ignoredUserIds })
        .where(eq(pokerSessionTasks.id, current.id))
      await tx
        .update(pokerSessions)
        .set({ revision: session.revision + 1 })
        .where(eq(pokerSessions.id, session.id))
      await completeRound()
      return
    }
    const next: Partial<typeof pokerSessions.$inferInsert> = { revision: session.revision + 1 }
    if (action === 'publish' && session.status === 'draft') next.status = 'lobby'
    else if (action === 'start' && session.status === 'lobby') {
      // Use the manager's current deck before the first vote; later rounds keep it.
      next.cards = project.settings.cards
      next.status = 'voting'
    } else if (
      action === 'revote' &&
      (session.status === 'reveal' || session.status === 'review')
    ) {
      const item = items.find((entry) => entry.id === body.taskId)
      if (!item || (session.status === 'reveal' && item.id !== current?.id))
        throw createError({ statusCode: 400, message: 'کار انتخاب‌شده معتبر نیست.' })
      await tx
        .update(pokerSessionTasks)
        .set({ round: item.round + 1, status: 'active', ignoredUserIds: [], revoteRequired: 0 })
        .where(eq(pokerSessionTasks.id, item.id))
      next.status = 'voting'
      next.activePosition = item.position
    } else if (
      (action === 'accept' && session.status === 'reveal') ||
      (action === 'calibrate' && session.status === 'review')
    ) {
      const item = action === 'accept' ? current : items.find((entry) => entry.id === body.taskId)
      if (!item) throw createError({ statusCode: 400, message: 'کار پیدا نشد.' })
      if (action === 'accept' && body.taskId !== item.id)
        throw createError({ statusCode: 409, message: 'کار فعال تغییر کرده است.' })
      const uncertainVotes = await tx
        .select({ id: pokerVotes.id })
        .from(pokerVotes)
        .where(
          and(
            eq(pokerVotes.sessionTaskId, item.id),
            eq(pokerVotes.round, item.round),
            eq(pokerVotes.value, '?'),
            inArray(
              pokerVotes.userId,
              participants
                .filter((person) => !item.ignoredUserIds.includes(person.userId))
                .map((person) => person.userId),
            ),
          ),
        )
      if (item.revoteRequired || uncertainVotes.length)
        throw createError({
          statusCode: 409,
          message: 'ابتدا ابهام را برطرف کنید و دوباره رأی بگیرید.',
        })
      const point = pointInput(body.point)
      const [task] = await selectedTasks(tx, context.projectId, [item.taskId])
      if (!task) throw createError({ statusCode: 404, message: 'کار پیدا نشد.' })
      await updateTask(tx, task, { point }, context.user.id)
      await tx.insert(estimateHistory).values({
        id: randomUUID(),
        sessionTaskId: item.id,
        userId: context.user.id,
        previousPoint: task.point,
        point,
        reason: action === 'accept' ? 'accepted' : 'calibrated',
      })
      await tx
        .update(pokerSessionTasks)
        .set({ finalPoint: point, status: 'estimated' })
        .where(eq(pokerSessionTasks.id, item.id))
      if (action === 'accept') {
        const pending = items.find((entry) => entry.id !== item.id && entry.status !== 'estimated')
        next.status = pending ? 'voting' : 'review'
        if (pending) {
          next.activePosition = pending.position
          await tx
            .update(pokerSessionTasks)
            .set({ status: 'active' })
            .where(eq(pokerSessionTasks.id, pending.id))
        }
      }
    } else if (
      action === 'finalize' &&
      session.status === 'review' &&
      items.every((item) => item.status === 'estimated')
    )
      next.status = 'finalized'
    else throw createError({ statusCode: 409, message: 'این عملیات در مرحله فعلی جلسه مجاز نیست.' })
    await tx.update(pokerSessions).set(next).where(eq(pokerSessions.id, session.id))
  })
  return pokerSnapshot(context.sessionId, context.user.id)
}
