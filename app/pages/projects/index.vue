<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'پروژه‌های شما | پیشرو' })
const { data: projects, error: loadError, refresh } = await useFetch('/api/projects')
const { user } = useAuth()
const createOpen = ref(false)
const name = ref('')
const { busy, run } = useAction()
async function create() {
  await run(async () => {
    const project = await $fetch('/api/projects', { method: 'POST', body: { name: name.value } })
    await refresh()
    createOpen.value = false
    await navigateTo(`/projects/${project.id}/sprint`)
  })
}
</script>

<template>
  <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
    <div><p class="mb-2 text-sm text-muted">سلام {{ user?.name }}، آماده یک قدم تازه؟</p><h1 class="text-3xl font-bold">پروژه‌های شما</h1></div>
    <button class="button-primary" @click="createOpen = true"><Icon name="lucide:plus" aria-hidden="true" /> پروژه جدید</button>
  </div>
  <p v-if="loadError" role="alert" class="panel p-5 text-red-700">{{ requestError(loadError) }}</p>
  <div v-else-if="projects?.length" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
    <NuxtLink v-for="project in projects" :key="project.id" :to="`/projects/${project.id}/sprint`" class="panel group p-6 transition-colors hover:border-brand-500">
      <div class="mb-6 flex items-center justify-between"><span class="h-12 w-12 flex items-center justify-center rounded-xl bg-brand-50 text-xl text-brand-700"><Icon name="lucide:folder-kanban" aria-hidden="true" /></span><span class="text-xs text-muted">{{ project.role === 'admin' ? 'مدیر پروژه' : 'عضو تیم' }}</span></div>
      <h2 class="break-words text-xl font-bold">{{ project.name }}</h2>
      <p class="mt-4 flex items-center justify-between text-sm text-muted">دیدن مسیر تیم<Icon name="lucide:arrow-left" class="text-brand-700" aria-hidden="true" /></p>
    </NuxtLink>
  </div>
  <EmptyState v-else title="اولین مسیر را با هم بسازید" description="یک پروژه بسازید، اعضای تیم را دعوت کنید و اولین کارها را به بک‌لاگ اضافه کنید." icon="lucide:folder-plus"><button class="button-primary" @click="createOpen = true">ساخت اولین پروژه</button></EmptyState>
  <UiDialog v-model="createOpen" title="یک پروژه تازه">
    <form class="space-y-5" @submit.prevent="create"><label class="block text-sm">نام پروژه<input v-model="name" class="field mt-2" required maxlength="120" placeholder="تیم روی چه چیزی کار می‌کند؟" /></label><button class="button-primary" :disabled="busy">ساخت پروژه</button></form>
  </UiDialog>
</template>
