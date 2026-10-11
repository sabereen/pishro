export default defineNuxtConfig({
  compatibilityDate: '2026-10-11',
  devtools: { enabled: true },
  modules: ['@unocss/nuxt', '@nuxt/icon'],
  css: ['@unocss/reset/tailwind.css', '~/assets/css/main.css'],
  typescript: { strict: true },
  runtimeConfig: { databaseUrl: '', githubTokens: '' },
  routeRules: {
    '/projects/**': { headers: { 'Cache-Control': 'private, no-store' } },
    '/profile': { headers: { 'Cache-Control': 'private, no-store' } },
    '/invite/**': { headers: { 'Cache-Control': 'private, no-store' } },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'fa', dir: 'rtl' },
      title: 'پیشرو | برنامه‌ریزی با هم',
      meta: [
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'description', content: 'پیشرو؛ فضایی ساده برای برآورد گروهی و برنامه‌ریزی بهتر تیم.' },
        { name: 'theme-color', content: '#10214d' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/pishro-icon.png' },
        { rel: 'preload', href: '/fonts/Estedad.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
      ],
    },
  },
  icon: {
    mode: 'css',
    provider: 'server',
    fallbackToApi: false,
    serverBundle: { collections: ['lucide'] },
    clientBundle: { scan: true },
  },
})
