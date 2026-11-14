<script setup lang="ts">
import { pokerLabels } from '#shared/scrum'
import { persianDate } from '#shared/calendar'

definePageMeta({ layout: 'project', middleware: 'auth', key: (route) => route.path })
const { data: project } = await useProject()
const route = useRoute()
const id = String(route.params.projectId)
const { user } = useAuth()
const { data: sessions, error: loadError, refresh } = await useFetch(`/api/projects/${id}/poker`)
const createOpen = ref(Boolean(route.query.tasks))
const name = ref('')
const sprintId = ref('')
const search = ref('')
const taskIds = ref(typeof route.query.tasks === 'string' ? route.query.tasks.split(',').filter((id) => project.value?.tasks.some((task) => task.id === id)) : [])
const participantIds = ref(project.value?.members.slice(0, 50).map((member) => member.id) ?? [])
const candidates = computed(() => project.value?.tasks.filter((task) => (!sprintId.value || task.sprintId === sprintId.value) && task.title.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())) ?? [])
const selectedCandidates = computed(() => candidates.value.filter((task) => taskIds.value.includes(task.id)).length)
const allCandidatesSelected = computed(() => candidates.value.length > 0 && selectedCandidates.value === candidates.value.length)
const outsideSelection = computed(() => taskIds.value.length - selectedCandidates.value)
function toggleCandidates() {
  const visibleIds = new Set(candidates.value.map((task) => task.id))
  taskIds.value = allCandidatesSelected.value
    ? taskIds.value.filter((id) => !visibleIds.has(id))
    : [...new Set([...taskIds.value, ...visibleIds])]
}
const { busy, run } = useAction()
async function create() {
  await run(async () => {
    const result = await $fetch(`/api/projects/${id}/poker`, { method: 'POST', body: { name: name.value, sprintId: sprintId.value || null, taskIds: taskIds.value, participantIds: participantIds.value } })
    await refresh()
    createOpen.value = false
    await navigateTo(`/projects/${id}/poker/${result.id}`)
  })
}
</script>

<template>
  <div class="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h1 class="text-2xl font-bold">پلنینگ پوکر</h1><p class="mt-2 text-sm text-muted">هر دیدگاه، یک تکه از تصویر؛ با هم به یک تخمین روشن برسید.</p></div><button class="button-primary" @click="createOpen = true"><Icon name="lucide:plus" aria-hidden="true" /> جلسه جدید</button></div>
  <p v-if="loadError" role="alert" class="panel p-5 text-red-700">{{ requestError(loadError) }}</p>
  <section v-else-if="sessions?.length" class="panel divide-y divide-line"><div v-for="session in sessions" :key="session.id" class="flex flex-wrap items-center gap-4 p-5"><span class="h-12 w-12 flex items-center justify-center rounded-xl bg-brand-50 text-xl text-brand-700"><Icon name="lucide:panels-top-left" aria-hidden="true" /></span><div class="min-w-0 flex-1"><h2 class="break-words font-bold">{{ session.name }}</h2><p class="mt-2 text-xs text-muted">{{ persianDate(session.createdAt) }}</p></div><span class="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">{{ pokerLabels[session.status] }}</span><NuxtLink v-if="session.invited" :to="`/projects/${id}/poker/${session.id}`" class="button-secondary text-sm">{{ session.status === 'finalized' ? 'دیدن تخمین‌ها' : 'ورود به جلسه' }}<Icon name="lucide:arrow-left" aria-hidden="true" /></NuxtLink><span v-else class="text-xs text-muted">ویژه شرکت‌کنندگان دعوت‌شده</span></div></section>
  <EmptyState v-else title="تیم را دور یک میز جمع کنید" description="چند کار از بک‌لاگ انتخاب کنید، مستقل رأی بدهید و تفاوت نگاه‌ها را به گفت‌وگو تبدیل کنید." icon="lucide:panels-top-left"><button class="button-primary" @click="createOpen = true">شروع اولین جلسه</button></EmptyState>
  <UiDialog v-model="createOpen" title="یک جلسه برای برآورد مشترک"><form class="space-y-5" @submit.prevent="create"><label class="block text-sm font-bold">نام جلسه<input v-model="name" class="field mt-2" required maxlength="120" placeholder="مثلاً برنامه‌ریزی اسپرینت ۲۴" /></label><label class="block text-sm">اسپرینت<select v-model="sprintId" class="field mt-2"><option value="">بدون اسپرینت / همه کارها</option><option v-for="sprint in project?.sprints.filter((item) => item.status !== 'completed')" :key="sprint.id" :value="sprint.id">{{ sprint.name }}</option></select></label><fieldset><legend class="mb-3 text-sm font-bold">کارها · {{ taskIds.length.toLocaleString('fa-IR') }} انتخاب</legend><input v-model="search" class="field mb-3 text-sm" type="search" placeholder="جست‌وجو در کارها…" aria-label="جست‌وجو برای انتخاب کار" /><div class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas p-3"><label class="flex min-h-11 items-center gap-3 text-sm font-bold"><input type="checkbox" class="h-4 w-4 accent-brand-600" :checked="allCandidatesSelected" :indeterminate="selectedCandidates > 0 && !allCandidatesSelected" :disabled="!candidates.length" @change="toggleCandidates" /><span>{{ sprintId && !search.trim() ? 'انتخاب همه کارهای اسپرینت' : 'انتخاب همه نتایج' }} · {{ candidates.length.toLocaleString('fa-IR') }}</span></label><button v-if="taskIds.length" type="button" class="min-h-11 px-2 text-xs text-muted" @click="taskIds = []">پاک کردن همه انتخاب‌ها</button></div><p v-if="outsideSelection" class="mb-3 text-xs leading-7 text-muted" role="status">{{ outsideSelection.toLocaleString('fa-IR') }} کار انتخاب‌شده خارج از فیلتر فعلی است؛ انتخاب‌ها حفظ می‌شوند.</p><p v-if="taskIds.length > 100" role="alert" class="mb-3 text-xs leading-7 text-amber-800">هر جلسه حداکثر ۱۰۰ کار دارد؛ تعداد انتخاب‌ها را کم کنید.</p><div class="max-h-55 overflow-y-auto space-y-2"><label v-for="task in candidates" :key="task.id" class="flex items-center gap-3 rounded-lg border border-line p-3 text-sm"><input v-model="taskIds" :value="task.id" type="checkbox" class="h-4 w-4 shrink-0 accent-brand-600" /><span class="min-w-0 flex-1 break-words">{{ task.title }}</span><PointBadge :point="task.point" /></label><p v-if="!candidates.length" class="p-4 text-xs leading-7 text-muted">کاری برای انتخاب نیست؛ ابتدا چند کار به بک‌لاگ اضافه کنید.</p></div></fieldset><fieldset><legend class="mb-3 text-sm font-bold">شرکت‌کنندگان</legend><div class="flex flex-wrap gap-2"><label v-for="member in project?.members" :key="member.id" class="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm"><input v-model="participantIds" :value="member.id" type="checkbox" :disabled="member.id === user?.id" class="accent-brand-600" /><UserAvatar :name="member.name" :src="member.avatarUrl" :size="28" />{{ member.name }}</label></div></fieldset><p class="text-xs leading-7 text-muted">شما تسهیل‌گر هستید. جلسه ابتدا به‌صورت پیش‌نویس ساخته می‌شود؛ بعد از ورود تیم، رأی‌گیری را شروع کنید.</p><button class="button-primary w-full" :disabled="busy || !taskIds.length || taskIds.length > 100">ساخت جلسه</button></form></UiDialog>
</template>
