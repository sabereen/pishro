import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { dateInTehran, datesBetween, isWorkingDay, todayInTehran } from '../../shared/calendar'
import type { ProjectOverview } from '../../shared/models'
import type { SprintMetrics } from '../../shared/scrum'
import { priorities, taskStatuses } from '../../shared/scrum'
import {
  projectMembers,
  projects,
  pullRequests,
  sprintPointEvents,
  sprints,
  users,
  workItems,
} from '../database/scrum'
import { useDatabase } from '../utils/database'
import type { DatabaseTransaction } from '../utils/database'
import { jsonValue } from '../utils/json'
import { enumInput, integerInput, textInput, markdownInput, uuidInput } from '../utils/validation'

export async function lockProject(
  tx: DatabaseTransaction,
  projectId: string,
  userId: string,
  admin = false,
) {
  const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for('update')
  const [member] = await tx
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
  if (!project || !member || (admin && member.role !== 'admin')) {
    throw createError({ statusCode: 403, message: 'به این پروژه دسترسی ندارید.' })
  }
  return project
}

export async function projectOverview(
  projectId: string,
  role: 'admin' | 'member',
): Promise<ProjectOverview> {
  return useDatabase().transaction(
    async (tx) => {
      const [project] = await tx.select().from(projects).where(eq(projects.id, projectId))
      if (!project) throw createError({ statusCode: 404, message: 'پروژه پیدا نشد.' })
      const members = await tx
        .select({ id: users.id, name: users.name, email: users.email, role: projectMembers.role })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, projectId))
        .orderBy(asc(projectMembers.createdAt))
      const sprintRows = await tx
        .select()
        .from(sprints)
        .where(eq(sprints.projectId, projectId))
        .orderBy(asc(sprints.startDate))
      const taskRows = await tx
        .select()
        .from(workItems)
        .where(eq(workItems.projectId, projectId))
        .orderBy(asc(workItems.rank), asc(workItems.id))
      const prs = await tx
        .select({ pr: pullRequests })
        .from(pullRequests)
        .innerJoin(workItems, eq(pullRequests.taskId, workItems.id))
        .where(eq(workItems.projectId, projectId))
      const events = await tx
        .select({ event: sprintPointEvents })
        .from(sprintPointEvents)
        .innerJoin(sprints, eq(sprintPointEvents.sprintId, sprints.id))
        .where(eq(sprints.projectId, projectId))
      const today = todayInTehran()
      const metrics: Record<string, SprintMetrics> = {}
      for (const sprint of sprintRows) {
        const items = taskRows.filter((task) => task.sprintId === sprint.id)
        const total = items.reduce((sum, task) => sum + (task.point ?? 0), 0)
        const done = items
          .filter((task) => task.status === 'done')
          .reduce((sum, task) => sum + (task.point ?? 0), 0)
        const dates = datesBetween(sprint.startDate, sprint.endDate)
        const days = dates.filter((date) => isWorkingDay(date, sprint.workingDays))
        const elapsed = days.filter((date) => date <= today).length
        const expected = (total * elapsed) / Math.max(days.length, 1)
        const sprintEvents = events
          .filter(({ event }) => event.sprintId === sprint.id)
          .map(({ event }) => ({
            ...event,
            date: dateInTehran(event.occurredAt),
          }))
        metrics[sprint.id] = {
          total,
          done,
          expected,
          delta: done - expected,
          remaining: total - done,
          day: elapsed,
          days: days.length,
          added: items
            .filter(
              (task) =>
                sprint.startedAt &&
                task.sprintAssignedAt &&
                task.sprintAssignedAt > sprint.startedAt,
            )
            .reduce((sum, task) => sum + (task.point ?? 0), 0),
          chart: dates.map((date) => ({
            date,
            expected: (total * days.filter((day) => day <= date).length) / Math.max(days.length, 1),
            actual: sprintEvents
              .filter((event) => event.date <= date)
              .reduce((sum, event) => sum + event.delta, 0),
          })),
        }
      }
      return {
        project: jsonValue(project),
        role,
        members,
        sprints: jsonValue(sprintRows),
        metrics,
        tasks: jsonValue(taskRows).map((task) => ({
          ...task,
          pullRequests: jsonValue(
            prs.filter(({ pr }) => pr.taskId === task.id).map(({ pr }) => pr),
          ),
        })),
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}

export function taskPatch(body: Record<string, unknown>) {
  const patch: Partial<
    Pick<
      typeof workItems.$inferInsert,
      'title' | 'description' | 'point' | 'status' | 'assigneeId' | 'sprintId' | 'priority'
    >
  > = {}
  if ('title' in body) patch.title = textInput(body.title, 240)
  if ('description' in body) patch.description = markdownInput(body.description)
  if ('point' in body) patch.point = body.point === null ? null : integerInput(body.point, 0, 100)
  if ('status' in body) patch.status = enumInput(body.status, taskStatuses)
  if ('priority' in body) patch.priority = enumInput(body.priority, priorities)
  if ('assigneeId' in body)
    patch.assigneeId = body.assigneeId === null ? null : uuidInput(body.assigneeId)
  if ('sprintId' in body) patch.sprintId = body.sprintId === null ? null : uuidInput(body.sprintId)
  return patch
}

export async function recordContribution(
  tx: DatabaseTransaction,
  old: typeof workItems.$inferSelect,
  next: typeof workItems.$inferSelect,
) {
  const changes = new Map<string, number>()
  if (old.sprintId && old.status === 'done') changes.set(old.sprintId, -(old.point ?? 0))
  if (next.sprintId && next.status === 'done')
    changes.set(next.sprintId, (changes.get(next.sprintId) ?? 0) + (next.point ?? 0))
  for (const [sprintId, delta] of changes) {
    if (delta)
      await tx
        .insert(sprintPointEvents)
        .values({ id: randomUUID(), sprintId, taskId: old.id, delta, occurredAt: new Date() })
  }
}

export async function updateTask(
  tx: DatabaseTransaction,
  task: typeof workItems.$inferSelect,
  patch: ReturnType<typeof taskPatch>,
  actorId: string,
) {
  // Planned sprint assignments are self-service, including edits through the backlog.
  const nextAssignee = 'assigneeId' in patch ? (patch.assigneeId ?? null) : task.assigneeId
  const nextSprint = 'sprintId' in patch ? (patch.sprintId ?? null) : task.sprintId
  if (nextAssignee !== task.assigneeId || nextSprint !== task.sprintId) {
    const ids = [...new Set([task.sprintId, nextSprint].filter((id): id is string => Boolean(id)))]
    const planned = ids.length
      ? await tx
          .select({ id: sprints.id })
          .from(sprints)
          .where(and(inArray(sprints.id, ids), eq(sprints.status, 'planned')))
      : []
    if (
      planned.length &&
      ((task.assigneeId && task.assigneeId !== actorId) ||
        (nextAssignee && nextAssignee !== actorId))
    ) {
      throw createError({
        statusCode: 403,
        message: 'در برنامه‌ریزی اسپرینت فقط می‌توانید کار خودتان را انتخاب یا آزاد کنید.',
      })
    }
  }
  if (patch.assigneeId) {
    const [member] = await tx
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, task.projectId),
          eq(projectMembers.userId, patch.assigneeId),
        ),
      )
    if (!member) throw createError({ statusCode: 400, message: 'مسئول باید عضو همین پروژه باشد.' })
  }
  if (patch.sprintId && patch.sprintId !== task.sprintId) {
    const [sprint] = await tx
      .select()
      .from(sprints)
      .where(and(eq(sprints.id, patch.sprintId), eq(sprints.projectId, task.projectId)))
    if (!sprint || sprint.status === 'completed')
      throw createError({ statusCode: 400, message: 'اسپرینت انتخاب‌شده قابل استفاده نیست.' })
  }
  const now = new Date()
  const next = {
    ...task,
    ...patch,
    updatedAt: now,
    revision: task.revision + 1,
    sprintAssignedAt:
      'sprintId' in patch && patch.sprintId !== task.sprintId
        ? patch.sprintId
          ? now
          : null
        : task.sprintAssignedAt,
    doneAt:
      patch.status === 'done' && task.status !== 'done'
        ? now
        : patch.status && patch.status !== 'done'
          ? null
          : task.doneAt,
  }
  await recordContribution(tx, task, next)
  await tx.update(workItems).set(next).where(eq(workItems.id, task.id))
}

export async function selectedTasks(tx: DatabaseTransaction, projectId: string, ids: string[]) {
  if (!ids.length) return []
  const selected = await tx
    .select()
    .from(workItems)
    .where(and(eq(workItems.projectId, projectId), inArray(workItems.id, ids)))
  if (selected.length !== ids.length)
    throw createError({ statusCode: 400, message: 'بعضی از کارها متعلق به این پروژه نیستند.' })
  return selected
}
