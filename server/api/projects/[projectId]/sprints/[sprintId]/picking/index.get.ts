import { requireTaskPicking, taskPickingSnapshot } from '../../../../../../services/task-picking'

export default defineEventHandler(async (event) => {
  const { projectId, sprintId, user } = await requireTaskPicking(event)
  return taskPickingSnapshot(projectId, sprintId, user.id)
})
