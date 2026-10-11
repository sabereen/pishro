<script setup lang="ts">
import type { PokerSnapshot } from '#shared/models'
import { cardLabel, pokerLabels } from '#shared/scrum'

definePageMeta({ layout: 'project', middleware: 'auth', key: (route) => route.path })
const route = useRoute()
const projectId = String(route.params.projectId)
const sessionId = String(route.params.sessionId)
const { data, error: loadError } = await useFetch<PokerSnapshot>(`/api/projects/${projectId}/poker/${sessionId}`)
const { snapshot, busy, error, connection, action } = usePlanningSession(projectId, sessionId, data.value ?? null)
const shareLink = ref('')
const copied = ref(false)
const showLink = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
onMounted(() => { shareLink.value = window.location.href })
onScopeDispose(() => { clearTimeout(timer) })
async function copy() {
  try {
    await navigator.clipboard.writeText(shareLink.value)
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => { copied.value = false }, 2500)
  } catch { showLink.value = true }
}
</script>

<template>
  <div v-if="loadError || !snapshot" class="panel p-7"><h1 class="mb-4 text-xl font-bold">جلسه در دسترس نیست</h1><p class="text-sm leading-8 text-muted">{{ loadError ? requestError(loadError) : 'دوباره تلاش کنید.' }}</p><NuxtLink :to="`/projects/${projectId}/poker`" class="button-secondary mt-5">بازگشت به جلسه‌ها</NuxtLink></div>
  <div v-else>
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4"><div><NuxtLink :to="`/projects/${projectId}/poker`" class="text-xs text-muted"><Icon name="lucide:arrow-right" aria-hidden="true" /> همه جلسه‌ها</NuxtLink><h1 class="mt-3 break-words text-2xl font-bold leading-10">{{ snapshot.session.name }}</h1><div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted"><span class="rounded-lg bg-white px-2 py-1.5">{{ pokerLabels[snapshot.session.status] }}</span><span class="flex items-center gap-2" role="status"><span class="h-2 w-2 rounded-full" :class="connection === 'connected' ? 'bg-brand-500' : 'bg-amber-500'" />{{ connection === 'connected' ? 'همگام با تیم' : connection === 'connecting' ? 'در حال اتصال…' : 'در حال اتصال دوباره…' }}</span></div></div><button class="button-secondary text-sm" @click="copy"><Icon :name="copied ? 'lucide:check' : 'lucide:link'" aria-hidden="true" />{{ copied ? 'لینک کپی شد' : 'لینک جلسه' }}</button></div>
    <input v-if="showLink" :value="shareLink" readonly class="field mb-5 text-left text-sm" dir="ltr" aria-label="لینک جلسه" @focus="($event.target as HTMLInputElement).select()" />
    <p v-if="error" role="alert" class="mb-5 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-700">{{ error }}</p>
    <EstimateReview v-if="snapshot.session.status === 'review' || snapshot.session.status === 'finalized'" :snapshot="snapshot" :busy="busy" @action="action" />
    <div v-else class="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
      <section v-if="snapshot.session.status === 'draft' || snapshot.session.status === 'lobby'" class="panel p-6 sm:p-8"><span class="h-16 w-16 flex items-center justify-center rounded-2xl bg-brand-50 text-3xl text-brand-700"><Icon name="lucide:users-round" aria-hidden="true" /></span><h2 class="mt-6 text-2xl font-bold">{{ snapshot.session.status === 'draft' ? 'میز گفت‌وگو آماده است' : 'تیم دور یک میز' }}</h2><p class="mt-4 text-sm leading-8 text-muted">{{ snapshot.tasks.length.toLocaleString('fa-IR') }} کار برای برآورد انتخاب شده است. هر نفر با حساب خودش وارد لینک جلسه می‌شود و مستقل رأی می‌دهد.</p><div class="my-6 rounded-xl border border-line bg-canvas p-5"><p class="text-lg font-bold">{{ snapshot.participants.filter((person) => person.joined).length.toLocaleString('fa-IR') }} / {{ snapshot.participants.length.toLocaleString('fa-IR') }} نفر وارد شده‌اند</p><p class="mt-2 text-xs leading-7 text-muted">لینک را با شرکت‌کنندگان دعوت‌شده به اشتراک بگذارید.</p></div><button v-if="snapshot.me.facilitator" class="button-primary w-full" :disabled="busy" @click="action(snapshot.session.status === 'draft' ? 'publish' : 'start')"><Icon name="lucide:play" aria-hidden="true" />{{ snapshot.session.status === 'draft' ? 'باز کردن لابی' : 'شروع رأی‌گیری' }}</button><p v-else class="text-sm leading-8 text-muted">شما آماده‌اید؛ تسهیل‌گر رأی‌گیری را شروع می‌کند.</p></section>
      <PlanningVotes v-else :snapshot="snapshot" :busy="busy" @action="action" />
      <aside class="space-y-5"><section class="panel p-5"><h2 class="mb-5 flex items-center gap-2 font-bold"><Icon name="lucide:users-round" aria-hidden="true" /> شرکت‌کنندگان</h2><ul class="space-y-4"><li v-for="person in snapshot.participants" :key="person.id" class="flex items-center gap-3"><span class="relative h-10 w-10 flex shrink-0 items-center justify-center rounded-xl bg-canvas text-sm font-bold">{{ person.name.slice(0, 1) }}<span class="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white" :class="person.online ? 'bg-brand-500' : 'bg-slate-300'" /></span><span class="min-w-0 flex-1"><span class="block break-words text-sm font-bold">{{ person.name }}{{ person.id === snapshot.me.id ? ' (شما)' : '' }}</span><span class="mt-1 block text-xs text-muted">{{ person.id === snapshot.session.facilitatorId ? 'تسهیل‌گر · ' : '' }}{{ person.online ? 'آنلاین' : person.joined ? 'آفلاین' : 'هنوز وارد نشده' }}</span></span><span v-if="snapshot.session.status === 'voting' || snapshot.session.status === 'reveal'" class="min-w-8 rounded-lg border border-line px-2 py-2 text-center text-sm font-bold" :class="person.hasVoted ? 'bg-brand-50 text-brand-700' : 'text-muted'" :aria-label="person.vote !== null ? `رأی ${cardLabel(person.vote)}` : person.ignored ? 'این دور نادیده گرفته شده' : person.hasVoted ? 'رأی داده' : 'رأی نداده'" role="img"><template v-if="person.vote !== null">{{ cardLabel(person.vote) }}</template><Icon v-else :name="person.ignored ? 'lucide:user-minus' : person.hasVoted ? 'lucide:check' : 'lucide:minus'" aria-hidden="true" /></span></li></ul></section><section class="panel p-5"><h2 class="mb-4 font-bold">مسیر برآورد</h2><ol class="max-h-70 overflow-y-auto space-y-2"><li v-for="task in snapshot.tasks" :key="task.id" class="flex items-start gap-2 rounded-xl p-3 text-sm leading-7" :class="task.position === snapshot.session.activePosition ? 'bg-brand-50 text-brand-700' : 'text-muted'"><Icon :name="task.status === 'estimated' ? 'lucide:circle-check' : task.status === 'active' ? 'lucide:circle-dot' : 'lucide:circle'" class="mt-1 shrink-0" aria-hidden="true" /><span class="min-w-0 flex-1 break-words">{{ task.title }}</span><PointBadge v-if="task.status === 'estimated'" :point="task.finalPoint" /></li></ol></section></aside>
    </div>
  </div>
</template>
