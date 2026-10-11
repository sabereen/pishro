<script setup lang="ts">
import type { Member } from '#shared/models'
import { cardLabel, pointValues } from '#shared/scrum'

definePageMeta({ layout: 'project', middleware: 'auth', key: (route) => route.path })
const { data: project } = await useProject()
const id = String(useRoute().params.projectId)
const { user } = useAuth()
const tab = ref('general')
const form = reactive({ name: project.value?.project.name ?? '', duration: project.value?.project.settings.duration ?? 10, workingDays: [...(project.value?.project.settings.workingDays ?? [])], cards: [...(project.value?.project.settings.cards ?? [])], repository: project.value?.project.settings.repository ?? '' })
const email = ref('')
const inviteLink = ref('')
const remove = ref<Member | null>(null)
const removeOpen = ref(false)
const { busy, run } = useAction()
const days = [{ value: 6, label: 'شنبه' }, { value: 0, label: 'یکشنبه' }, { value: 1, label: 'دوشنبه' }, { value: 2, label: 'سه‌شنبه' }, { value: 3, label: 'چهارشنبه' }, { value: 4, label: 'پنجشنبه' }, { value: 5, label: 'جمعه' }]
async function save() {
  await run(async () => { await $fetch(`/api/projects/${id}`, { method: 'PATCH', body: { name: form.name, settings: { duration: form.duration, workingDays: form.workingDays, cards: form.cards, repository: form.repository } } }); await refreshProject(id) }, 'تنظیمات پروژه ذخیره شد')
}
async function addMember() {
  await run(async () => { await $fetch(`/api/projects/${id}/members`, { method: 'POST', body: { email: email.value } }); email.value = ''; await refreshProject(id) }, 'عضو به پروژه اضافه شد')
}
async function invite() {
  await run(async () => {
    const result = await $fetch<{ token: string }>(`/api/projects/${id}/members`, { method: 'POST', body: {} })
    inviteLink.value = `${window.location.origin}/invite/${result.token}`
  })
}
async function role(userId: string, role: string) {
  await run(async () => { await $fetch(`/api/projects/${id}/members`, { method: 'PATCH', body: { userId, role } }); await refreshProject(id) }, 'نقش عضو به‌روز شد')
}
async function removeMember() {
  if (!remove.value) return
  const userId = remove.value.id
  await run(async () => {
    await $fetch(`/api/projects/${id}/members`, { method: 'DELETE', body: { userId } })
    removeOpen.value = false
    if (userId === user.value?.id) await navigateTo('/projects')
    else await refreshProject(id)
  }, 'عضو از پروژه خارج شد')
}
</script>

<template>
  <h1 class="mb-6 text-2xl font-bold">تنظیمات پروژه</h1>
  <div class="mb-6 flex flex-wrap gap-2"><button v-for="item in [{ id: 'general', title: 'عمومی', icon: 'lucide:sliders-horizontal' }, { id: 'members', title: 'اعضای تیم', icon: 'lucide:users-round' }, { id: 'github', title: 'GitHub', icon: 'lucide:git-branch' }]" :key="item.id" class="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm" :class="tab === item.id ? 'border-brand-100 bg-brand-50 font-bold text-brand-700' : 'border-line bg-white text-muted'" :aria-pressed="tab === item.id" @click="tab = item.id"><Icon :name="item.icon" aria-hidden="true" />{{ item.title }}</button></div>
  <p v-if="project?.role !== 'admin'" class="mb-5 rounded-xl bg-canvas p-4 text-sm text-muted">تنظیمات پروژه فقط توسط مدیر قابل تغییر است.</p>
  <form v-if="tab === 'general'" class="panel max-w-3xl p-6" @submit.prevent="save"><fieldset :disabled="project?.role !== 'admin' || busy" class="space-y-6"><label class="block text-sm font-bold">نام پروژه<input v-model="form.name" class="field mt-2" required maxlength="120" /></label><label class="block text-sm font-bold">طول پیش‌فرض اسپرینت (روز کاری)<input v-model.number="form.duration" class="field mt-2 max-w-40" type="number" min="1" max="60" required /></label><fieldset><legend class="mb-3 text-sm font-bold">روزهای کاری</legend><div class="flex flex-wrap gap-2"><label v-for="day in days" :key="day.value" class="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm"><input v-model="form.workingDays" :value="day.value" type="checkbox" class="accent-brand-600" />{{ day.label }}</label></div><p class="mt-3 text-xs leading-7 text-muted">هر اسپرینت، روزهای کاری زمان ساخت خودش را حفظ می‌کند تا محاسبات قبلی با تغییر تنظیمات جابه‌جا نشوند.</p></fieldset><fieldset><legend class="mb-3 text-sm font-bold">کارت‌های پیش‌فرض پوکر</legend><div class="flex flex-wrap gap-2" dir="ltr"><label v-for="card in [...pointValues.map(String), '?', 'coffee']" :key="card" class="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm"><input v-model="form.cards" :value="card" type="checkbox" class="accent-brand-600" />{{ cardLabel(card) }}</label></div></fieldset><button v-if="project?.role === 'admin'" class="button-primary" :disabled="busy">ذخیره تنظیمات</button></fieldset></form>
  <section v-else-if="tab === 'members'" class="panel max-w-4xl p-6"><h2 class="mb-5 text-lg font-bold">آدم‌های پشت این پروژه</h2><div class="space-y-3"><div v-for="member in project?.members" :key="member.id" class="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"><span class="h-11 w-11 flex shrink-0 items-center justify-center rounded-xl bg-canvas font-bold">{{ member.name.slice(0, 1) }}</span><div class="min-w-0 flex-1"><p class="text-sm font-bold">{{ member.name }}</p><p class="mt-1 truncate text-xs text-muted" dir="ltr">{{ member.email }}</p></div><select :value="member.role" class="field w-auto text-xs" :disabled="project?.role !== 'admin' || busy" :aria-label="`نقش ${member.name}`" @change="role(member.id, ($event.target as HTMLSelectElement).value)"><option value="admin">مدیر</option><option value="member">عضو</option></select><button v-if="project?.role === 'admin'" class="h-11 w-11 rounded-lg text-muted hover:bg-red-50 hover:text-red-700" :disabled="busy" :aria-label="`حذف ${member.name}`" @click="remove = member; removeOpen = true"><Icon name="lucide:user-minus" aria-hidden="true" /></button></div></div><div v-if="project?.role === 'admin'" class="mt-6 border-t border-line pt-6"><form class="flex flex-wrap gap-3" @submit.prevent="addMember"><input v-model="email" class="field min-w-40 flex-1 text-left" dir="ltr" type="email" placeholder="teammate@example.com" required aria-label="ایمیل عضو جدید" /><button class="button-primary text-sm" :disabled="busy">افزودن با ایمیل</button></form><div class="mt-5 flex flex-wrap items-center gap-3"><button class="button-secondary text-sm" :disabled="busy" @click="invite"><Icon name="lucide:link" aria-hidden="true" /> ساخت لینک دعوت</button><span class="text-xs text-muted">برای هم‌تیمی‌هایی که هنوز حساب ندارند · اعتبار ۷ روز</span></div><label v-if="inviteLink" class="mt-4 block text-xs text-muted">این لینک را فقط با اعضای تیم به اشتراک بگذارید<input :value="inviteLink" class="field mt-2 text-left text-sm" dir="ltr" readonly @focus="($event.target as HTMLInputElement).select()" /></label></div></section>
  <form v-else class="panel max-w-3xl space-y-5 p-6" @submit.prevent="save"><h2 class="flex items-center gap-2 text-lg font-bold"><Icon name="lucide:git-branch" aria-hidden="true" /> مخزن GitHub</h2><p class="text-sm leading-8 text-muted">با تعیین مخزن، فقط PRهای همان مخزن به کارها متصل می‌شوند. لینک PR را در جزئیات هر Task وارد کنید.</p><label class="block text-sm">مخزن پیش‌فرض<input v-model="form.repository" class="field mt-2 text-left" dir="ltr" placeholder="organization/repository" :disabled="project?.role !== 'admin' || busy" maxlength="220" /></label><p class="rounded-xl bg-canvas p-4 text-xs leading-7 text-muted">اطلاعات هنگام اتصال لینک دریافت می‌شوند. همگام‌سازی خودکار و تغییر خودکار وضعیت کار، بخشی از این نسخه نیست.</p><button v-if="project?.role === 'admin'" class="button-primary" :disabled="busy">ذخیره مخزن</button></form>
  <UiDialog v-model="removeOpen" title="خارج کردن عضو از پروژه"><p class="text-sm leading-8 text-muted">{{ remove?.name }} دیگر به این پروژه دسترسی نخواهد داشت. مسئولیت کارهای او خالی می‌شود و گزارش‌ها و رأی‌های گذشته حفظ می‌شوند.</p><div class="mt-6 flex gap-3"><button class="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white" :disabled="busy" @click="removeMember">خارج کردن عضو</button><button class="button-secondary" @click="removeOpen = false">انصراف</button></div></UiDialog>
</template>
