import { eq } from 'drizzle-orm'
import { pointValues } from '../../../../shared/scrum'
import { projects } from '../../../database/scrum'
import { lockProject } from '../../../services/projects'
import { requireProject } from '../../../utils/auth'
import { useDatabase } from '../../../utils/database'
import { integerInput, objectBody, textInput } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { projectId, user } = await requireProject(event, true)
  const body = objectBody(await readBody<unknown>(event))
  const name = textInput(body.name, 120)
  const settings = objectBody(body.settings)
  const duration = integerInput(settings.duration, 1, 60)
  if (!Array.isArray(settings.workingDays) || !settings.workingDays.length) {
    throw createError({ statusCode: 400, message: 'حداقل یک روز کاری انتخاب کنید.' })
  }
  const workingDays = [...new Set(settings.workingDays.map((day) => integerInput(day, 0, 6)))]
  const allowed = [...pointValues.map(String), '?', 'coffee']
  if (!Array.isArray(settings.cards) || !settings.cards.length || settings.cards.some((card) => typeof card !== 'string' || !allowed.includes(card))) {
    throw createError({ statusCode: 400, message: 'کارت‌های پوکر معتبر نیستند.' })
  }
  const cards = [...new Set(settings.cards as string[])]
  if (!cards.some((card) => /^\d+$/.test(card))) throw createError({ statusCode: 400, message: 'حداقل یک کارت عددی انتخاب کنید.' })
  const repository = textInput(settings.repository, 220, false)
  if (repository && !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw createError({ statusCode: 400, message: 'مخزن را به شکل owner/repository وارد کنید.' })
  await useDatabase().transaction(async (tx) => {
    await lockProject(tx, projectId, user.id, true)
    await tx.update(projects).set({ name, settings: { duration, workingDays, cards, repository } }).where(eq(projects.id, projectId))
  })
  return { ok: true }
})
