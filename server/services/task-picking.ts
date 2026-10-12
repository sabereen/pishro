import { and, asc, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { TaskPickingSnapshot } from '../../shared/models'
import { projectMembers, sprints, users, workItems } from '../database/scrum'
import { requireProject } from '../utils/auth'
import { useDatabase } from '../utils/database'
import { gravatarUrl } from '../utils/avatar'
import { jsonValue } from '../utils/json'
import { enumInput, integerInput, uuidInput } from '../utils/validation'
import { lockProject, updateTask } from './projects'

export async function requireTaskPicking(event: H3Event) {
  const context = await requireProject(event)
  return { ...context, sprintId: uuidInput(getRouterParam(event, 'sprintId')) }
}

export async function taskPickingSnapshot(
  projectId: string,
  sprintId: string,
  userId: string,
): Promise<TaskPickingSnapshot> {
  return useDatabase().transaction(
    async (tx) => {
      const members = await tx
        .select({ id: users.id, name: users.name, email: users.email, role: projectMembers.role })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, projectId))
        .orderBy(asc(projectMembers.createdAt))
      const me = members.find((member) => member.id === userId)
      if (!me)
        throw createError({ statusCode: 403, message: 'دسترسی شما به پروژه پایان یافته است.' })
      const [sprint] = await tx
        .select()
        .from(sprints)
        .where(and(eq(sprints.id, sprintId), eq(sprints.projectId, projectId)))
      if (!sprint) throw createError({ statusCode: 404, message: 'اسپرینت پیدا نشد.' })
      const tasks = await tx
        .select({
          id: workItems.id,
          title: workItems.title,
          point: workItems.point,
          assigneeId: workItems.assigneeId,
          revision: workItems.revision,
        })
        .from(workItems)
        .where(and(eq(workItems.projectId, projectId), eq(workItems.sprintId, sprintId)))
        .orderBy(asc(workItems.rank), asc(workItems.id))
      return {
        sprint: jsonValue(sprint),
        me: { id: userId, admin: me.role === 'admin' },
        members: members.map(({ id, name, email }) => ({ id, name, avatarUrl: gravatarUrl(email) })),
        tasks,
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}

export async function taskPickingAction(
  context: Awaited<ReturnType<typeof requireTaskPicking>>,
  body: Record<string, unknown>,
) {
  const action = enumInput(body.action, ['pick', 'release'] as const)
  const taskId = uuidInput(body.taskId)
  const revision = integerInput(body.revision, 0, 2147483647)
  await useDatabase().transaction(async (tx) => {
    // Use the same lock order as task editing, membership changes and sprint start.
    await lockProject(tx, context.projectId, context.user.id)
    const [sprint] = await tx
      .select()
      .from(sprints)
      .where(and(eq(sprints.id, context.sprintId), eq(sprints.projectId, context.projectId)))
      .for('update')
    if (!sprint) throw createError({ statusCode: 404, message: 'اسپرینت پیدا نشد.' })
    if (sprint.status !== 'planned')
      throw createError({ statusCode: 409, message: 'انتخاب کار فقط پیش از شروع اسپرینت باز است.' })
    const [task] = await tx
      .select()
      .from(workItems)
      .where(
        and(
          eq(workItems.id, taskId),
          eq(workItems.projectId, context.projectId),
          eq(workItems.sprintId, context.sprintId),
        ),
      )
      .for('update')
    if (!task) throw createError({ statusCode: 404, message: 'این کار در اسپرینت نیست.' })
    if (action === 'pick' && task.assigneeId) {
      const [person] = await tx
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, task.assigneeId))
      throw createError({
        statusCode: 409,
        message: `${person?.name ?? 'هم‌تیمی شما'} زودتر این کار را انتخاب کرد.`,
      })
    }
    if (action === 'release' && task.assigneeId !== context.user.id) {
      throw createError({ statusCode: 403, message: 'فقط می‌توانید کار خودتان را آزاد کنید.' })
    }
    if (task.revision !== revision)
      throw createError({ statusCode: 409, message: 'این کار تغییر کرده است؛ دوباره تلاش کنید.' })
    // Assignee always comes from authentication, never from the request body.
    await updateTask(
      tx,
      task,
      { assigneeId: action === 'pick' ? context.user.id : null },
      context.user.id,
    )
  })
  return taskPickingSnapshot(context.projectId, context.sprintId, context.user.id)
}
