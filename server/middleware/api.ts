export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/') || event.path.startsWith('/api/_nuxt_icon')) return
  if (event.path.startsWith('/api/rooms')) {
    throw createError({ statusCode: 410, message: 'جلسه‌های پوکر اکنون داخل پروژه‌ها ساخته می‌شوند.' })
  }

  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (['GET', 'HEAD', 'OPTIONS'].includes(event.method)) return

  const origin = getHeader(event, 'origin')
  if (origin && origin !== getRequestURL(event).origin) {
    throw createError({ statusCode: 403, message: 'مبدأ درخواست معتبر نیست.' })
  }
  if (getHeader(event, 'sec-fetch-site') === 'cross-site') {
    throw createError({ statusCode: 403, message: 'مبدأ درخواست معتبر نیست.' })
  }
  if (!getHeader(event, 'content-type')?.startsWith('application/json')) {
    throw createError({ statusCode: 415, message: 'درخواست باید از نوع JSON باشد.' })
  }
  const length = Number(getHeader(event, 'content-length'))
  if (length > 262144) {
    throw createError({ statusCode: 413, message: 'درخواست بیش از حد بزرگ است.' })
  }
})
