<script setup lang="ts">
import { datesBetween, isWorkingDay, persianDate, todayInTehran } from '#shared/calendar'

definePageMeta({ layout: 'project', middleware: 'auth', key: (route) => route.path })
const { data: project } = await useProject()
const id = String(useRoute().params.projectId)
const selectedId = ref(project.value?.sprints.find((item) => item.status === 'active')?.id ?? project.value?.sprints.at(-1)?.id ?? '')
const sprint = computed(() => project.value?.sprints.find((item) => item.id === selectedId.value))
const metrics = computed(() => selectedId.value ? project.value?.metrics[selectedId.value] : null)
const createOpen = ref(false)
const completeOpen = ref(false)
const drawer = ref(false)
const taskId = ref<string | null>(null)
const name = ref('')
const startDate = ref(todayInTehran())
const endDate = ref('')
const taskIds = ref<string[]>([])
const { busy, run } = useAction()
watch([startDate, createOpen], () => {
  if (!startDate.value) return
  const days = project.value?.project.settings.workingDays ?? [6, 0, 1, 2, 3]
  const date = new Date(`${startDate.value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 366)
  const work = datesBetween(startDate.value, date.toISOString().slice(0, 10)).filter((day) => isWorkingDay(day, days))
  endDate.value = work[(project.value?.project.settings.duration ?? 10) - 1] ?? startDate.value
})
async function create() {
  await run(async () => {
    const result = await $fetch(`/api/projects/${id}/sprints`, { method: 'POST', body: { name: name.value, startDate: startDate.value, endDate: endDate.value, taskIds: taskIds.value } })
    await refreshProject(id)
    selectedId.value = result.id
    createOpen.value = false
    name.value = ''; taskIds.value = []
  }, 'اسپرینت برای شروع آماده است')
}
async function action(action: 'start' | 'complete') {
  await run(async () => { await $fetch(`/api/projects/${id}/sprints`, { method: 'PATCH', body: { id: selectedId.value, action } }); await refreshProject(id); completeOpen.value = false }, action === 'start' ? 'اسپرینت شروع شد' : 'اسپرینت پایان یافت')
}
const format = (value: number) => value.toLocaleString('fa-IR', { maximumFractionDigits: 1 })
</script>

<template>
  <div class="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h1 class="text-2xl font-bold">اسپرینت</h1><p class="mt-2 text-sm text-muted">با یک نگاه ببینید تیم کجای مسیر است.</p></div><div class="flex gap-3"><select v-if="project?.sprints.length" v-model="selectedId" class="field w-auto text-sm" aria-label="انتخاب اسپرینت"><option v-for="item in project.sprints" :key="item.id" :value="item.id">{{ item.name }}{{ item.status === 'active' ? ' · فعال' : item.status === 'completed' ? ' · پایان‌یافته' : ' · برنامه‌ریزی‌شده' }}</option></select><button v-if="project?.role === 'admin'" class="button-primary text-sm" @click="createOpen = true"><Icon name="lucide:plus" aria-hidden="true" /> اسپرینت جدید</button></div></div>
  <template v-if="sprint && metrics && project">
    <div class="mb-5 flex flex-wrap items-center justify-between gap-4"><p class="text-sm text-muted">{{ persianDate(sprint.startDate) }} تا {{ persianDate(sprint.endDate) }}</p><button v-if="project.role === 'admin' && sprint.status === 'planned'" class="button-primary text-sm" :disabled="busy" @click="action('start')">شروع اسپرینت<Icon name="lucide:play" aria-hidden="true" /></button><button v-else-if="project.role === 'admin' && sprint.status === 'active'" class="button-secondary text-sm" @click="completeOpen = true">پایان اسپرینت</button></div>
    <div class="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5"><div v-for="metric in [{ label: 'پوینت انجام‌شده', value: metrics.done }, { label: 'کل پوینت', value: metrics.total }, { label: 'پیشرفت مورد انتظار', value: metrics.expected }, { label: 'پوینت باقی‌مانده', value: metrics.remaining }, { label: 'اضافه پس از شروع', value: metrics.added }]" :key="metric.label" class="panel p-4"><p class="text-xs text-muted">{{ metric.label }}</p><p class="mt-3 text-3xl font-bold">{{ format(metric.value) }}</p></div></div>
    <SprintChart :metrics="metrics" />
    <div class="mb-5 mt-8 flex items-center justify-between"><h2 class="text-lg font-bold">تابلوی تیم</h2><NuxtLink :to="`/projects/${id}/backlog`" class="text-sm text-brand-700">مدیریت کارها در بک‌لاگ<Icon name="lucide:arrow-left" class="mr-1" aria-hidden="true" /></NuxtLink></div>
    <KanbanBoard :project="project" :sprint-id="sprint.id" @open="taskId = $event; drawer = true" />
  </template>
  <EmptyState v-else title="مسیر بعدی تیم را مشخص کنید" description="یک اسپرینت بسازید و چند کار از بک‌لاگ به آن اختصاص دهید. بعد از شروع، پیشرفت تیم همین‌جا دیده می‌شود." icon="lucide:flag"><button v-if="project?.role === 'admin'" class="button-primary" @click="createOpen = true">ساخت اولین اسپرینت</button><p v-else class="text-sm text-muted">مدیر پروژه می‌تواند اولین اسپرینت را بسازد.</p></EmptyState>
  <UiDialog v-model="createOpen" title="اسپرینت جدید"><form class="space-y-5" @submit.prevent="create"><label class="block text-sm">نام اسپرینت<input v-model="name" class="field mt-2" required maxlength="120" placeholder="مثلاً اسپرینت ۲۴" /></label><div class="grid grid-cols-2 gap-4"><label class="text-sm">شروع<input v-model="startDate" class="field mt-2" type="date" required /></label><label class="text-sm">پایان<input v-model="endDate" class="field mt-2" type="date" :min="startDate" required /></label></div><fieldset><legend class="mb-3 text-sm">کارهای بدون اسپرینت</legend><div class="max-h-55 overflow-y-auto space-y-2"><label v-for="task in project?.tasks.filter((item) => !item.sprintId)" :key="task.id" class="flex items-center gap-3 rounded-lg border border-line px-3 py-3 text-sm"><input v-model="taskIds" :value="task.id" type="checkbox" class="accent-brand-600" /><span class="flex-1">{{ task.title }}</span><PointBadge :point="task.point" /></label><p v-if="!project?.tasks.some((task) => !task.sprintId)" class="text-xs leading-7 text-muted">فعلاً کار بدون اسپرینتی ندارید؛ بعداً از بک‌لاگ اضافه کنید.</p></div></fieldset><button class="button-primary" :disabled="busy">ساخت اسپرینت</button></form></UiDialog>
  <UiDialog v-model="completeOpen" title="پایان اسپرینت"><p class="text-sm leading-8 text-muted">کارهای باقی‌مانده در این اسپرینت حفظ می‌شوند و می‌توانید از بک‌لاگ آن‌ها را به اسپرینت بعد منتقل کنید.</p><div class="mt-6 flex gap-3"><button class="button-primary" :disabled="busy" @click="action('complete')">پایان اسپرینت</button><button class="button-secondary" @click="completeOpen = false">ادامه کار</button></div></UiDialog>
  <TaskDrawer v-if="project" v-model="drawer" :project="project" :task-id="taskId" />
</template>
