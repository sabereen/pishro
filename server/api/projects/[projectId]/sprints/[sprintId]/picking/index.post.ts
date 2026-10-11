import { requireTaskPicking, taskPickingAction } from '../../../../../../services/task-picking'
import { objectBody } from '../../../../../../utils/validation'

export default defineEventHandler(async (event) => {
  const context = await requireTaskPicking(event)
  return taskPickingAction(context, objectBody(await readBody<unknown>(event)))
})
