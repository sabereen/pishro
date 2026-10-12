<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.projectId))
const { data: project, error } = await useProject()
const { data: projectList } = await useFetch('/api/projects')
const { user, logout } = useAuth()
const { run } = useAction()
const search = ref('')
const drawer = ref(false)
const taskId = ref<string | null>(null)
const items = [
  { path: 'sprint', title: 'اسپرینت', icon: 'lucide:columns-3' },
  { path: 'backlog', title: 'بک‌لاگ', icon: 'lucide:list-todo' },
  { path: 'daily', title: 'گزارش روزانه', icon: 'lucide:sun' },
  { path: 'poker', title: 'پلنینگ پوکر', icon: 'lucide:panels-top-left' },
  { path: 'settings', title: 'تنظیمات', icon: 'lucide:settings-2' },
]
const active = computed(() => items.find((item) => route.path.includes(`/${item.path}`)))
const matches = computed(() => search.value.trim() ? project.value?.tasks.filter((task) => task.title.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())).slice(0, 8) ?? [] : [])
function openTask(id: string | null) { taskId.value = id; drawer.value = true; search.value = '' }
async function switchProject(event: Event) {
  await navigateTo(`/projects/${(event.target as HTMLSelectElement).value}/sprint`)
}
</script>

<template>
  <div>
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:z-100 focus:bg-white focus:p-4">رفتن به محتوای اصلی</a>
    <aside class="border-b border-line bg-white lg:fixed lg:inset-y-0 lg:right-0 lg:z-20 lg:w-60 lg:flex lg:flex-col lg:border-b-0 lg:border-l">
      <NuxtLink to="/projects" class="flex items-center gap-3 px-6 py-5"><img src="/pishro-icon.png" width="40" height="40" class="rounded-xl" alt="" /><span><span class="block text-xl font-bold">پیشرو</span><span class="text-xs text-muted">جایی برای پیش رفتن تیم</span></span></NuxtLink>
      <div class="px-4 pb-4"><label for="project-switcher" class="sr-only">انتخاب پروژه</label><select id="project-switcher" :value="id" class="field text-sm" @change="switchProject"><option v-for="item in projectList" :key="item.id" :value="item.id">{{ item.name }}</option></select></div>
      <nav class="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col" aria-label="بخش‌های پروژه">
        <NuxtLink v-for="item in items" :key="item.path" :to="`/projects/${id}/${item.path}`" class="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors" :class="active?.path === item.path ? 'bg-brand-50 font-bold text-brand-700' : 'text-muted hover:bg-canvas'" :aria-current="active?.path === item.path ? 'page' : undefined"><Icon :name="item.icon" class="text-lg" aria-hidden="true" />{{ item.title }}</NuxtLink>
      </nav>
      <div class="mt-auto hidden border-t border-line p-4 lg:block">
        <NuxtLink to="/profile" class="flex items-center gap-3 rounded-xl p-2"><UserAvatar :name="user?.name" :src="user?.avatarUrl" /><span class="min-w-0"><span class="block truncate text-sm font-bold">{{ user?.name }}</span><span class="text-xs text-muted">حساب کاربری</span></span></NuxtLink>
        <div class="mt-3 flex items-center justify-between"><NuxtLink to="/projects" class="rounded-lg p-2 text-xs text-muted">همه پروژه‌ها</NuxtLink><button class="h-11 w-11 rounded-lg text-muted hover:bg-canvas" aria-label="خروج" @click="run(logout)"><Icon name="lucide:log-out" aria-hidden="true" /></button></div>
      </div>
    </aside>
    <div class="lg:pr-60">
      <header class="relative flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-5 py-4 sm:px-8">
        <p class="text-sm text-muted"><span class="font-bold text-ink">{{ project?.project.name }}</span><span class="mx-2">/</span>{{ active?.title }}</p>
        <div class="flex items-center gap-3">
          <div class="relative hidden sm:block"><label class="sr-only" for="task-search">جست‌وجوی کارها</label><input id="task-search" v-model="search" class="field w-55 py-2 text-sm" placeholder="جست‌وجوی کارها…" type="search" @keydown.esc="search = ''" /><Transition name="ui-popover"><div v-if="search.trim()" class="panel absolute left-0 top-full z-30 mt-2 w-80 p-2"><button v-for="task in matches" :key="task.id" class="block w-full rounded-lg px-3 py-3 text-right text-sm hover:bg-canvas" @click="openTask(task.id)">{{ task.title }}</button><p v-if="!matches.length" class="p-4 text-sm text-muted">کاری با این عنوان پیدا نشد.</p></div></Transition></div>
          <button class="button-primary py-2 text-sm" @click="openTask(null)"><Icon name="lucide:plus" aria-hidden="true" /> کار جدید</button>
          <NuxtLink to="/profile" class="h-11 w-11 flex items-center justify-center rounded-full lg:hidden" :aria-label="`حساب ${user?.name ?? ''}`"><UserAvatar :name="user?.name" :src="user?.avatarUrl" :size="36" /></NuxtLink>
        </div>
      </header>
      <main id="main" class="mx-auto max-w-[1600px] px-4 py-6 sm:px-8">
        <p v-if="error" role="alert" class="panel p-6 text-sm leading-8 text-red-700">{{ requestError(error) }}<NuxtLink to="/projects" class="mt-4 block text-brand-700">بازگشت به پروژه‌ها</NuxtLink></p>
        <template v-else-if="project"><SprintBar :project="project" /><slot /></template>
      </main>
    </div>
    <TaskDrawer v-if="project" :key="id" v-model="drawer" :project="project" :task-id="taskId" />
  </div>
</template>
