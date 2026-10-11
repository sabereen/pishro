export function readText(body: unknown, key: string, maxLength: number) {
  if (typeof body !== 'object' || body === null || !(key in body)) {
    throw createError({ statusCode: 400, message: 'اطلاعات درخواست کامل نیست.' })
  }
  const value = Reflect.get(body, key) as unknown
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw createError({ statusCode: 400, message: 'مقدار واردشده معتبر نیست.' })
  }
  return value.trim()
}

export function readTaskTitles(body: unknown) {
  const raw = readText(body, 'tasks', 12000)
  const titles = raw.split('\n').map((title) => title.trim()).filter(Boolean)
  if (titles.length < 1 || titles.length > 50 || titles.some((title) => title.length > 240)) {
    throw createError({ statusCode: 400, message: 'بین ۱ تا ۵۰ کار، هر کدام حداکثر ۲۴۰ نویسه وارد کنید.' })
  }
  return titles
}

export function readRevision(body: unknown) {
  if (typeof body === 'object' && body !== null && 'revision' in body &&
    typeof body.revision === 'number' && Number.isSafeInteger(body.revision) && body.revision >= 0) {
    return body.revision
  }
  throw createError({ statusCode: 400, message: 'نسخه دور معتبر نیست.' })
}
