<script setup lang="ts">
import type { DailyReport } from '#shared/models'
import { datesBetween, isWorkingDay, persianDate, todayInTehran } from '#shared/calendar'

definePageMeta({ layout: 'project', middleware: 'auth', key: (route) => route.path })
const { data: project } = await useProject()
const id = String(useRoute().params.projectId)
const { user } = useAuth()
const selectedId = ref(project.value?.sprints.find((item) => item.status === 'active')?.id ?? project.value?.sprints.at(-1)?.id ?? '')
const sprint = computed(() => project.value?.sprints.find((item) => item.id === selectedId.value))
const metrics = computed(() => project.value?.metrics[selectedId.value])
const today = todayInTehran()
const days = computed(() => sprint.value ? datesBetween(sprint.value.startDate, sprint.value.endDate).filter((date) => isWorkingDay(date, sprint.value!.workingDays)) : [])
const { data: reports, error: loadError, refresh } = await useFetch<DailyReport[]>(`/api/projects/${id}/daily`, { query: { sprintId: selectedId }, immediate: Boolean(selectedId.value), watch: false })
const matrixMembers = computed(() => {
  const members = (project.value?.members ?? []).map((member) => ({ id: member.id, name: member.name, former: false }))
  for (const report of reports.value ?? []) {
    if (!members.some((member) => member.id === report.userId)) members.push({ id: report.userId, name: report.authorName, former: true })
  }
  return members
})
const reportsToday = computed(() => (reports.value ?? []).filter((report) =>
  report.date === today && project.value?.members.some((member) => member.id === report.userId),
).length)
watch(selectedId, () => { if (selectedId.value) void refresh() })
const open = ref(false)
const cell = ref({ userId: '', date: today })
const editing = computed(() => cell.value.userId === user.value?.id && cell.value.date <= today)
const selectedReport = computed(() => reports.value?.find((report) => report.userId === cell.value.userId && report.date === cell.value.date))
const form = reactive({ yesterday: '', today: '', blockers: '', taskIds: [] as string[] })
const { busy, run } = useAction()
function reportOf(userId: string, date: string) { return reports.value?.find((report) => report.userId === userId && report.date === date) }
function show(userId: string, date: string) {
  cell.value = { userId, date }
  const report = reportOf(userId, date)
  Object.assign(form, { yesterday: report?.yesterday ?? '', today: report?.today ?? '', blockers: report?.blockers ?? '', taskIds: report?.taskIds ?? [] })
  open.value = true
}
async function save() {
  await run(async () => {
    await $fetch(`/api/projects/${id}/daily`, { method: 'PUT', body: { sprintId: selectedId.value, date: cell.value.date, ...form } })
    await refresh()
    open.value = false
  }, 'گزارش شما ثبت شد')
}
const number = (value: number) => value.toLocaleString('fa-IR', { maximumFractionDigits: 1 })
</script>

<template>
  <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold">گزارش روزانه</h1>
      <p class="mt-2 text-sm text-muted">امروز روی چه چیزی کار می‌کنیم؟ چه چیزی کمک لازم دارد؟</p>
    </div>
    <div class="flex flex-wrap gap-3">
      <select v-if="project?.sprints.length" v-model="selectedId" class="field w-auto text-sm" aria-label="اسپرینت گزارش‌ها">
        <option v-for="item in project.sprints" :key="item.id" :value="item.id">{{ item.name }}</option>
      </select>
      <button
        v-if="sprint && user && today >= sprint.startDate && today <= sprint.endDate && isWorkingDay(today, sprint.workingDays)"
        class="button-primary text-sm"
        @click="show(user.id, today)"
      >
        <Icon name="lucide:pencil-line" aria-hidden="true" /> گزارش امروز من
      </button>
    </div>
  </div>
  <EmptyState v-if="!sprint" title="گزارش‌ها از یک اسپرینت شروع می‌شوند" description="ابتدا یک اسپرینت بسازید تا روزهای کاری و گزارش‌های تیم کنار هم دیده شوند." icon="lucide:sun"><NuxtLink :to="`/projects/${id}/sprint`" class="button-primary">رفتن به اسپرینت</NuxtLink></EmptyState>
  <template v-else>
    <section v-if="metrics" class="panel mb-6 p-5"><h2 class="mb-4 text-lg font-bold">حال‌وهوای اسپرینت</h2><div class="grid grid-cols-2 gap-4 sm:grid-cols-4"><div><p class="text-xs text-muted">واقعی</p><p class="mt-2 text-2xl font-bold">{{ number(metrics.done) }} <span class="text-xs font-normal text-muted">از {{ number(metrics.total) }}</span></p></div><div><p class="text-xs text-muted">مورد انتظار</p><p class="mt-2 text-2xl font-bold">{{ number(metrics.expected) }}</p></div><div><p class="text-xs text-muted">فاصله با برنامه</p><p class="mt-2 text-2xl font-bold" :class="metrics.delta < 0 ? 'text-amber-700' : 'text-brand-700'">{{ metrics.delta > 0 ? '+' : '' }}{{ number(metrics.delta) }}</p></div><div><p class="text-xs text-muted">گزارش امروز</p><p class="mt-2 text-2xl font-bold">{{ reportsToday.toLocaleString('fa-IR') }} <span class="text-xs font-normal text-muted">نفر از {{ project?.members.length.toLocaleString('fa-IR') }}</span></p></div></div></section>
    <p v-if="loadError" role="alert" class="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ requestError(loadError) }}</p>
    <section class="panel overflow-hidden"><div class="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5"><h2 class="font-bold">روزهای تیم</h2><div class="flex flex-wrap gap-4 text-xs text-muted"><span class="flex items-center gap-1"><Icon name="lucide:circle-check" class="text-brand-600" aria-hidden="true" /> ثبت شده</span><span class="flex items-center gap-1"><Icon name="lucide:clock-3" class="text-amber-600" aria-hidden="true" /> امروز، در انتظار</span><span class="flex items-center gap-1"><Icon name="lucide:circle" aria-hidden="true" /> ثبت نشده</span></div></div>
      <div class="overflow-x-auto">
        <table class="w-full text-center text-sm">
          <thead>
            <tr class="bg-canvas text-xs text-muted">
              <th class="sticky right-0 z-10 min-w-36 bg-canvas p-4 text-right">عضو تیم</th>
              <th v-for="date in days" :key="date" class="min-w-22 p-3" :class="date === today ? 'text-brand-700' : ''">
                <span class="block">{{ new Intl.DateTimeFormat('fa-IR', { weekday: 'short', timeZone: 'Asia/Tehran' }).format(new Date(`${date}T12:00:00Z`)) }}</span>
                <span class="mt-2 block whitespace-nowrap font-normal">{{ persianDate(date, true) }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in matrixMembers" :key="member.id" class="border-t border-line">
              <th class="sticky right-0 z-10 bg-white px-4 py-3 text-right font-medium">
                {{ member.name }}
                <span v-if="member.former" class="mr-1 text-xs text-muted">(عضو پیشین)</span>
                <span v-else-if="member.id === user?.id" class="mr-1 text-xs text-muted">(شما)</span>
              </th>
              <td v-for="date in days" :key="date" class="p-1">
                <button
                  class="mx-auto h-12 w-12 flex items-center justify-center rounded-xl text-lg hover:bg-canvas disabled:cursor-default disabled:opacity-40"
                  :disabled="date > today || (member.former && !reportOf(member.id, date))"
                  :aria-label="`${member.name}، ${persianDate(date)}، ${reportOf(member.id, date) ? 'گزارش ثبت شده' : date === today ? 'در انتظار گزارش' : date > today ? 'روز آینده' : 'گزارش ثبت نشده'}`"
                  @click="show(member.id, date)"
                >
                  <Icon v-if="reportOf(member.id, date)" name="lucide:circle-check" class="text-brand-600" aria-hidden="true" />
                  <Icon v-else-if="member.former" name="lucide:minus" class="text-slate-300" aria-hidden="true" />
                  <Icon v-else-if="date === today" name="lucide:clock-3" class="text-amber-600" aria-hidden="true" />
                  <Icon v-else-if="date < today" name="lucide:circle" class="text-slate-300" aria-hidden="true" />
                  <span v-else class="text-slate-300">—</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <p class="mt-4 text-xs leading-7 text-muted">روی هر روز کلیک کنید تا گزارش را بخوانید؛ گزارش روزهای خودتان قابل ویرایش است. این جدول برای هماهنگی تیم است.</p>
  </template>
  <UiDialog v-model="open" :title="`${matrixMembers.find((member) => member.id === cell.userId)?.name ?? 'گزارش روزانه'} · ${persianDate(cell.date, true)}`">
    <form v-if="editing" class="space-y-5" @submit.prevent="save"><label class="block text-sm font-bold">دیروز چه کردید؟<textarea v-model="form.yesterday" class="field mt-2 min-h-22 leading-7" maxlength="4000" /></label><label class="block text-sm font-bold">امروز چه می‌کنید؟<textarea v-model="form.today" class="field mt-2 min-h-22 leading-7" required maxlength="4000" /></label><label class="block text-sm font-bold">مانع یا نیاز به کمک<textarea v-model="form.blockers" class="field mt-2 min-h-18 leading-7" maxlength="4000" placeholder="اگر مانعی نیست، خالی بگذارید" /></label><fieldset><legend class="mb-3 text-sm font-bold">کارهای مرتبط</legend><div class="max-h-40 overflow-y-auto space-y-2"><label v-for="task in project?.tasks.filter((item) => item.sprintId === selectedId)" :key="task.id" class="flex items-center gap-2 rounded-lg bg-canvas p-3 text-sm"><input v-model="form.taskIds" :value="task.id" type="checkbox" class="accent-brand-600" />{{ task.title }}</label></div></fieldset><button class="button-primary w-full" :disabled="busy">{{ selectedReport ? 'ذخیره تغییرات' : 'ثبت گزارش' }}</button></form>
    <div v-else-if="selectedReport" class="space-y-6"><section v-for="section in [{ label: 'دیروز', value: selectedReport.yesterday }, { label: 'امروز', value: selectedReport.today }, { label: 'موانع', value: selectedReport.blockers }]" :key="section.label"><h3 class="mb-2 text-sm font-bold">{{ section.label }}</h3><p class="whitespace-pre-wrap break-words text-sm leading-8 text-muted">{{ section.value || 'موردی ثبت نشده است.' }}</p></section><section v-if="selectedReport.taskIds.length"><h3 class="mb-3 text-sm font-bold">کارهای مرتبط</h3><p v-for="taskId in selectedReport.taskIds" :key="taskId" class="mb-2 rounded-lg bg-canvas p-3 text-sm">{{ project?.tasks.find((task) => task.id === taskId)?.title ?? 'کار حذف‌شده' }}</p></section></div>
    <p v-else class="py-6 text-center text-sm leading-8 text-muted">برای این روز گزارشی ثبت نشده است.</p>
  </UiDialog>
</template>
