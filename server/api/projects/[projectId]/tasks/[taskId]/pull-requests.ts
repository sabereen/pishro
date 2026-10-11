import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { projects, pullRequests, workItems } from '../../../../../database/scrum'
import { lockProject, selectedTasks } from '../../../../../services/projects'
import { requireProject } from '../../../../../utils/auth'
import { useDatabase } from '../../../../../utils/database'
import { integerInput, objectBody, textInput, uuidInput } from '../../../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { projectId, user } = await requireProject(event)
  const taskId = uuidInput(getRouterParam(event, 'taskId'))
  const body = objectBody(await readBody<unknown>(event))
  if (event.method === 'DELETE') {
    const id = uuidInput(body.id)
    await useDatabase().transaction(async (tx) => {
      await lockProject(tx, projectId, user.id)
      await selectedTasks(tx, projectId, [taskId])
      await tx.delete(pullRequests).where(and(eq(pullRequests.id, id), eq(pullRequests.taskId, taskId)))
    })
    return { ok: true }
  }
  if (event.method !== 'POST') throw createError({ statusCode: 405, message: 'عملیات پشتیبانی نمی‌شود.' })
  const raw = textInput(body.url, 500)
  let url: URL
  try { url = new URL(raw) } catch { throw createError({ statusCode: 400, message: 'لینک PR معتبر نیست.' }) }
  const match = url.pathname.match(/^\/([\w.-]+)\/([\w.-]+)\/pull\/([1-9]\d*)\/?$/)
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || !match) {
    throw createError({ statusCode: 400, message: 'لینک یک Pull Request از github.com وارد کنید.' })
  }
  const repository = `${match[1]}/${match[2]}`
  const number = integerInput(Number(match[3]), 1, 2147483647)
  const [project] = await useDatabase().select({ settings: projects.settings }).from(projects).where(eq(projects.id, projectId))
  const [task] = await useDatabase().select({ id: workItems.id }).from(workItems).where(and(eq(workItems.id, taskId), eq(workItems.projectId, projectId)))
  if (!project || !task) throw createError({ statusCode: 404, message: 'کار پیدا نشد.' })
  if (project.settings.repository && project.settings.repository.toLowerCase() !== repository.toLowerCase()) {
    throw createError({ statusCode: 400, message: 'این PR به مخزن تنظیم‌شده برای پروژه تعلق ندارد.' })
  }
  const { githubTokens } = useRuntimeConfig(event)
  let token = ''
  if (project.settings.repository) {
    try {
      const credentials: unknown = typeof githubTokens === 'string' ? JSON.parse(githubTokens || '{}') : githubTokens
      if (credentials && typeof credentials === 'object' && projectId in credentials) {
        const candidate: unknown = Reflect.get(credentials, projectId)
        if (typeof candidate === 'string') token = candidate
      }
    } catch {
      throw createError({ statusCode: 503, message: 'تنظیمات دسترسی GitHub معتبر نیست؛ با مدیر سرویس هماهنگ کنید.' })
    }
  }
  let result: unknown
  try {
    result = await $fetch(`https://api.github.com/repos/${repository}/pulls/${number}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Pishro', 'X-GitHub-Api-Version': '2026-03-10', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      timeout: 10000, retry: 0,
    })
  } catch {
    throw createError({ statusCode: 422, message: 'اطلاعات PR دریافت نشد. لینک و دسترسی مخزن را بررسی کنید؛ مخزن خصوصی به توکن سرور نیاز دارد.' })
  }
  const metadata = objectBody(result)
  const title = textInput(metadata.title, 500)
  const status = metadata.merged_at ? 'merged' as const : metadata.state === 'closed' ? 'closed' as const : metadata.draft ? 'draft' as const : 'open' as const
  await useDatabase().transaction(async (tx) => {
    const project = await lockProject(tx, projectId, user.id)
    if (project.settings.repository && project.settings.repository.toLowerCase() !== repository.toLowerCase()) {
      throw createError({ statusCode: 400, message: 'این PR به مخزن تنظیم‌شده برای پروژه تعلق ندارد.' })
    }
    await selectedTasks(tx, projectId, [taskId])
    const values = { repository, number, title, status, fetchedAt: new Date() }
    await tx.insert(pullRequests).values({ id: randomUUID(), taskId, url: `https://github.com/${repository}/pull/${number}`, ...values })
      .onDuplicateKeyUpdate({ set: values })
  })
  return { ok: true }
})
