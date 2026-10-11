import { planningAction, requirePoker } from '../../../../../services/planning'
import { objectBody } from '../../../../../utils/validation'

export default defineEventHandler(async (event) => {
  const context = await requirePoker(event)
  return planningAction(context, objectBody(await readBody<unknown>(event)))
})
