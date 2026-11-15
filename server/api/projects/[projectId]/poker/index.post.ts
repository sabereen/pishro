import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import {
  pokerParticipants,
  pokerSessions,
  pokerSessionTasks,
  projectMembers,
  sprints,
} from '../../../../database/scrum'
import { lockProject, selectedTasks } from '../../../../services/projects'
import { requireProject } from '../../../../utils/auth'
import { useDatabase } from '../../../../utils/database'
import { enumInput, idList, objectBody, textInput, uuidInput } from '../../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { projectId, user } = await requireProject(event)
  const body = objectBody(await readBody<unknown>(event))
  const name = textInput(body.name, 120)
  const mode = body.mode === undefined ? 'tasks' : enumInput(body.mode, ['tasks', 'free'] as const)
  const taskIds = idList(body.taskIds ?? [])
  if (mode === 'free' && (taskIds.length || body.sprintId))
    throw createError({ statusCode: 400, message: 'جلسه آزاد به کار یا اسپرینت وابسته نیست.' })
  const participantIds = [...new Set([...idList(body.participantIds, 50), user.id])]
  if (participantIds.length > 50)
    throw createError({ statusCode: 400, message: 'هر جلسه حداکثر ۵۰ شرکت‌کننده دارد.' })
  const sprintId = body.sprintId ? uuidInput(body.sprintId) : null
  if (mode === 'tasks' && !taskIds.length)
    throw createError({ statusCode: 400, message: 'حداقل یک کار انتخاب کنید.' })
  const id = randomUUID()
  await useDatabase().transaction(async (tx) => {
    const project = await lockProject(tx, projectId, user.id)
    await selectedTasks(tx, projectId, taskIds)
    const members = await tx
      .select({ id: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId))
    if (participantIds.some((person) => !members.some((member) => member.id === person))) {
      throw createError({ statusCode: 400, message: 'شرکت‌کنندگان باید عضو پروژه باشند.' })
    }
    if (sprintId) {
      const [sprint] = await tx
        .select({ id: sprints.id })
        .from(sprints)
        .where(and(eq(sprints.id, sprintId), eq(sprints.projectId, projectId)))
      if (!sprint)
        throw createError({ statusCode: 400, message: 'اسپرینت متعلق به این پروژه نیست.' })
    }
    await tx.insert(pokerSessions).values({
      id,
      projectId,
      sprintId,
      name,
      mode,
      freeRound: mode === 'free' ? { round: 1, votes: {} } : null,
      facilitatorId: user.id,
      cards: project.settings.cards,
    })
    if (taskIds.length)
      await tx.insert(pokerSessionTasks).values(
        taskIds.map((taskId, position) => ({
          id: randomUUID(),
          sessionId: id,
          projectId,
          taskId,
          position,
          ignoredUserIds: [],
          status: position === 0 ? ('active' as const) : ('pending' as const),
        })),
      )
    await tx
      .insert(pokerParticipants)
      .values(participantIds.map((userId) => ({ id: randomUUID(), sessionId: id, userId })))
  })
  return { id }
})
