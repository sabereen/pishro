<script setup lang="ts">
import type { PokerSnapshot } from '#shared/models'
import { cardLabel, isNumericCard, numericVotes } from '#shared/scrum'

const props = defineProps<{
  snapshot: PokerSnapshot
  busy: boolean
  error: string
  connection: 'connecting' | 'connected' | 'reconnecting'
}>()
const emit = defineEmits<{ action: [action: string, fields?: Record<string, unknown>] }>()
const current = computed(() => props.snapshot.tasks.find((task) => task.position === props.snapshot.session.activePosition))
const votes = computed(() => current.value?.votes.filter((vote) => vote.round === current.value?.round) ?? [])
const statistics = computed(() => numericVotes(votes.value.map((vote) => vote.value)))
const eligible = computed(() => props.snapshot.participants.filter((person) => !person.ignored))
const voted = computed(() => eligible.value.filter((person) => person.hasVoted).length)
const waiting = computed(() => eligible.value.filter((person) => !person.hasVoted))
const ignoredMe = computed(() => props.snapshot.participants.find((person) => person.id === props.snapshot.me.id)?.ignored ?? false)
const voting = computed(() => props.snapshot.session.status === 'voting')
const distribution = computed(() => [...new Set([
  ...props.snapshot.session.cards,
  ...votes.value.map((vote) => vote.value),
])].map((card) => ({
  card,
  count: votes.value.filter((vote) => vote.value === card).length,
})).filter((item) => item.count > 0))
const point = ref(3)
const details = ref(false)
const detailTab = ref<'team' | 'tasks'>('team')
const selectedPerson = ref<string | null>(null)
const dialog = shallowRef<HTMLDialogElement>()
const heading = shallowRef<HTMLElement>()
const titleId = useId()
const pointId = useId()
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
let mounted = false

onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  dialog.value?.showModal()
  mounted = true
  heading.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => {
  mounted = false
  dialog.value?.close()
  document.body.style.overflow = previousOverflow
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
})
watch([() => props.snapshot.session.status, () => current.value?.id, () => current.value?.round], async () => {
  selectedPerson.value = null
  if (!voting.value) {
    const choices = props.snapshot.session.cards.filter(isNumericCard).map(Number)
    const median = statistics.value.median ?? 3
    point.value = choices.sort((a, b) => Math.abs(a - median) - Math.abs(b - median))[0] ?? 3
  }
  await nextTick()
  if (mounted && !details.value) heading.value?.focus({ preventScroll: true })
}, { immediate: true })
function leave() {
  void navigateTo(`/projects/${props.snapshot.session.projectId}/poker`)
}
</script>

<template>
  <dialog ref="dialog" class="poker-focus" :aria-labelledby="titleId" @cancel.prevent="leave">
    <div v-if="current" class="focus-frame">
      <header class="focus-header">
        <div class="flex min-w-0 items-center gap-3">
          <NuxtLink :to="`/projects/${snapshot.session.projectId}/poker`" class="h-11 w-11 flex shrink-0 items-center justify-center rounded-xl border border-line bg-white" aria-label="بازگشت به جلسه‌ها؛ جلسه ادامه دارد"><Icon name="lucide:arrow-right" aria-hidden="true" /></NuxtLink>
          <div class="min-w-0"><p class="truncate text-sm font-bold">{{ snapshot.session.name }}</p><p class="mt-1 flex items-center gap-2 text-xs text-muted" role="status"><span class="h-1.5 w-1.5 rounded-full" :class="connection === 'connected' ? 'bg-brand-500' : 'bg-amber-500'" />{{ connection === 'connected' ? 'همگام با تیم' : connection === 'connecting' ? 'در حال اتصال…' : 'در حال اتصال دوباره…' }}</p></div>
        </div>
        <button type="button" class="button-secondary shrink-0 text-xs" @click="details = true"><Icon name="lucide:users-round" aria-hidden="true" />تیم و مسیر<span class="hidden sm:inline"> · {{ snapshot.participants.length.toLocaleString('fa-IR') }} نفر</span></button>
      </header>
      <div class="focus-task">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>کار {{ (current.position + 1).toLocaleString('fa-IR') }} از {{ snapshot.tasks.length.toLocaleString('fa-IR') }} · دور {{ current.round.toLocaleString('fa-IR') }}</span>
          <ol class="flex items-center gap-2" aria-label="مراحل برآورد کار">
            <li :class="voting ? 'font-bold text-brand-700' : ''" :aria-current="voting ? 'step' : undefined">۱. انتخاب کارت</li><li aria-hidden="true">/</li>
            <li :class="!voting ? 'font-bold text-brand-700' : ''" :aria-current="!voting ? 'step' : undefined">۲. گفت‌وگو و ثبت</li>
          </ol>
        </div>
        <h1 :id="titleId" ref="heading" tabindex="-1" class="focus-title">{{ current.title }}</h1>
      </div>
      <main class="focus-body">
        <div class="focus-stage">
          <section v-if="voting" aria-label="میز انتخاب کارت">
            <div class="mb-5 text-center">
              <p class="text-base font-bold sm:text-lg">{{ ignoredMe ? 'این دور بدون رأی شما ادامه دارد' : snapshot.me.vote === null ? 'برآورد شما کدام کارت است؟' : `کارت ${cardLabel(snapshot.me.vote)} انتخاب شد` }}</p>
              <p class="mt-2 text-xs leading-6 text-muted">{{ ignoredMe ? 'در دور بعد دوباره می‌توانید رأی بدهید.' : 'رأی شما پنهان است؛ تا تکمیل رأی‌گیری می‌توانید آن را عوض کنید.' }}</p>
            </div>
            <fieldset :disabled="busy || ignoredMe" class="poker-deck" dir="ltr">
              <legend class="sr-only">انتخاب کارت برآورد</legend>
              <button v-for="card in snapshot.session.cards" :key="card" type="button" class="poker-card" :class="snapshot.me.vote === card ? 'is-selected' : ''" :aria-pressed="snapshot.me.vote === card" :aria-label="card === 'coffee' ? 'نیاز به استراحت' : card === '?' ? 'نیاز به توضیح بیشتر' : `برآورد ${card}`" @click="emit('action', 'vote', { taskId: current.id, value: card })">
                <span class="card-corner" aria-hidden="true"><Icon name="lucide:diamond" /></span>
                <Icon v-if="card === 'coffee'" name="lucide:coffee" aria-hidden="true" /><span v-else>{{ card }}</span>
                <span class="card-mark" aria-hidden="true"><Icon :name="snapshot.me.vote === card ? 'lucide:circle-check' : 'lucide:diamond'" /></span>
              </button>
            </fieldset>
            <p class="mt-4 text-center text-xs text-muted">? توضیح بیشتر <span class="mx-3">·</span> ☕ استراحت</p>
          </section>
          <section v-else-if="current.revoteRequired" class="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center sm:p-8" aria-label="رفع ابهام پیش از رأی‌گیری مجدد">
            <Icon name="lucide:message-circle-question" class="text-4xl text-amber-700" aria-hidden="true" />
            <h2 class="mt-4 text-xl font-bold text-amber-900">اول ابهام‌ها را روشن کنیم</h2>
            <p class="mt-3 text-sm leading-8 text-amber-800">حداقل یک رأی علامت سؤال بود؛ رأی‌ها پنهان می‌مانند. درباره کار گفت‌وگو کنید و سپس دوباره کارت انتخاب کنید.</p>
          </section>
          <section v-else aria-label="نتیجه رأی‌گیری">
            <div class="mb-5 text-center"><p class="text-lg font-bold">کارت‌ها روی میز است</p><p class="mt-2 text-xs leading-6 text-muted">از کمترین و بیشترین برآورد شروع کنید و به یک تخمین مشترک برسید.</p></div>
            <div class="result-distribution" dir="ltr">
              <div v-for="item in distribution" :key="item.card" class="rounded-2xl border border-brand-100 bg-brand-50 px-3 py-4 text-center"><p class="text-3xl font-bold text-brand-700">{{ cardLabel(item.card) }}</p><p class="mt-3 text-xs text-muted" dir="rtl">{{ item.count.toLocaleString('fa-IR') }} رأی</p></div>
            </div>
            <dl class="mx-auto mt-5 grid max-w-lg grid-cols-3 gap-3 text-center">
              <div v-for="metric in [{ label: 'میانه', value: statistics.median }, { label: 'میانگین', value: statistics.average }, { label: 'دامنه اختلاف', value: statistics.range }]" :key="metric.label" class="rounded-xl border border-line bg-white p-3"><dt class="text-xs text-muted">{{ metric.label }}</dt><dd class="mt-2 text-xl font-bold">{{ metric.value === null ? '—' : metric.value.toLocaleString('fa-IR', { maximumFractionDigits: 2 }) }}</dd></div>
            </dl>
            <p class="mx-auto mt-4 max-w-lg text-center text-xs leading-7" :class="statistics.disagreement ? 'text-amber-800' : 'text-muted'">{{ statistics.disagreement ? 'اختلاف رأی بالاست؛ پیش از ثبت، تفاوت نگاه‌ها را بررسی کنید.' : 'جزئیات رأی هر نفر در «تیم و مسیر» در دسترس است.' }}</p>
          </section>
        </div>
      </main>
      <footer class="focus-footer">
        <p v-if="error" role="alert" class="focus-error rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-7 text-red-700">{{ error }}</p>
        <div v-if="voting" class="mx-auto w-full max-w-2xl">
          <div class="flex items-center justify-between gap-3 text-sm"><span class="font-bold" role="status" aria-live="polite">{{ voted.toLocaleString('fa-IR') }} از {{ eligible.length.toLocaleString('fa-IR') }} نفر رأی داده‌اند</span><button type="button" class="min-h-11 text-xs text-brand-700" @click="detailTab = 'team'; details = true">{{ waiting.length ? `${waiting.length.toLocaleString('fa-IR')} نفر باقی مانده` : 'نمایش نتیجه…' }}<Icon name="lucide:chevron-left" class="mr-1" aria-hidden="true" /></button></div>
          <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="پیشرفت رأی‌گیری" :aria-valuenow="voted" :aria-valuemax="eligible.length" :aria-valuemin="0"><div class="h-full rounded-full bg-brand-500" :style="{ width: `${eligible.length ? voted / eligible.length * 100 : 100}%` }" /></div>
          <p class="mt-3 text-center text-xs leading-6 text-muted">با آخرین رأی، کارت‌ها برای همه رو می‌شوند.</p>
        </div>
        <div v-else-if="current.revoteRequired" class="text-center"><button v-if="snapshot.me.facilitator" class="button-primary" :disabled="busy" @click="emit('action', 'revote', { taskId: current.id })"><Icon name="lucide:rotate-ccw" aria-hidden="true" />شروع رأی‌گیری مجدد</button><p v-else class="text-sm leading-7 text-muted">پس از رفع ابهام، تسهیل‌گر دور بعد را شروع می‌کند.</p></div>
        <form v-else-if="snapshot.me.facilitator" class="focus-actions mx-auto flex max-w-3xl flex-wrap items-end justify-center gap-3" @submit.prevent="emit('action', 'accept', { point, taskId: current.id })">
          <div class="w-28"><label :for="pointId" class="mb-2 block text-xs font-bold">تخمین نهایی</label><input :id="pointId" v-model.number="point" class="field py-2.5 text-center" type="number" required min="0" max="100" step="0.5" :disabled="busy" /></div>
          <button type="button" class="button-secondary text-xs" :disabled="busy" @click="emit('action', 'revote', { taskId: current.id })"><Icon name="lucide:rotate-ccw" aria-hidden="true" />رأی‌گیری مجدد</button>
          <button class="focus-accept button-primary text-sm" :disabled="busy">{{ snapshot.tasks.some((task) => task.id !== current?.id && task.status !== 'estimated') ? 'ثبت و کار بعدی' : 'ثبت و بازبینی تخمین‌ها' }}<Icon name="lucide:arrow-left" aria-hidden="true" /></button>
        </form>
        <p v-else class="text-center text-sm leading-7 text-muted">در حال گفت‌وگو؛ تسهیل‌گر تخمین نهایی را ثبت می‌کند.</p>
      </footer>
    </div>
    <UiDialog v-model="details" title="تیم و مسیر برآورد" drawer>
      <div class="mb-5 flex gap-2" aria-label="جزئیات جلسه"><button type="button" class="button-secondary flex-1 text-sm" :class="detailTab === 'team' ? 'border-brand-600 text-brand-700' : ''" :aria-pressed="detailTab === 'team'" @click="detailTab = 'team'">شرکت‌کنندگان</button><button type="button" class="button-secondary flex-1 text-sm" :class="detailTab === 'tasks' ? 'border-brand-600 text-brand-700' : ''" :aria-pressed="detailTab === 'tasks'" @click="detailTab = 'tasks'">کارهای جلسه</button></div>
      <template v-if="detailTab === 'team'">
        <p v-if="snapshot.me.facilitator && voting" class="mb-4 text-xs leading-7 text-muted">اگر کسی در دسترس نیست، می‌توانید فقط این دور را بدون رأی او ادامه دهید.</p>
        <ul class="space-y-3"><li v-for="person in snapshot.participants" :key="person.id" class="rounded-xl border border-line p-3">
          <div class="flex items-center gap-3"><UserAvatar :name="person.name" :src="person.avatarUrl" :size="36" /><div class="min-w-0 flex-1"><p class="break-words text-sm font-bold">{{ person.name }}{{ person.id === snapshot.me.id ? ' (شما)' : '' }}</p><p class="mt-1 text-xs text-muted">{{ person.id === snapshot.session.facilitatorId ? 'تسهیل‌گر · ' : '' }}{{ person.ignored ? 'این دور بدون رأی' : person.hasVoted ? 'رأی داده' : 'در انتظار رأی' }} · {{ person.online ? 'آنلاین' : 'آفلاین' }}</p></div><span class="min-w-9 text-center text-lg font-bold" :aria-label="person.vote !== null ? `رأی ${cardLabel(person.vote)}` : person.hasVoted ? 'کارت پنهان' : 'بدون رأی'"><template v-if="person.vote !== null">{{ cardLabel(person.vote) }}</template><Icon v-else :name="person.ignored ? 'lucide:user-minus' : person.hasVoted ? 'lucide:check' : 'lucide:minus'" aria-hidden="true" /></span>
          <button v-if="snapshot.me.facilitator && voting && !person.hasVoted && !person.ignored" type="button" class="h-11 w-11 rounded-lg border border-line" :aria-label="`ادامه این دور بدون رأی ${person.name}`" :aria-expanded="selectedPerson === person.id" :disabled="busy" @click="selectedPerson = selectedPerson === person.id ? null : person.id"><Icon name="lucide:user-minus" aria-hidden="true" /></button></div>
          <div v-if="selectedPerson === person.id && voting && !person.hasVoted && !person.ignored" class="mt-3 border-t border-line pt-3"><button type="button" class="button-secondary w-full text-xs" :disabled="busy" @click="emit('action', 'ignore', { taskId: current?.id, userId: person.id }); selectedPerson = null">ادامه این دور بدون رأی {{ person.name }}</button></div>
        </li></ul>
      </template>
      <ol v-else class="space-y-2"><li v-for="task in snapshot.tasks" :key="task.id" class="flex items-start gap-3 rounded-xl border border-line p-3 text-sm leading-7" :class="task.position === snapshot.session.activePosition ? 'bg-brand-50 text-brand-700' : 'text-muted'" :aria-current="task.position === snapshot.session.activePosition ? 'step' : undefined"><Icon :name="task.status === 'estimated' ? 'lucide:circle-check' : task.status === 'active' ? 'lucide:circle-dot' : 'lucide:circle'" class="mt-1 shrink-0" aria-hidden="true" /><span class="min-w-0 flex-1 break-words">{{ task.title }}</span><PointBadge v-if="task.status === 'estimated'" :point="task.finalPoint" /></li></ol>
    </UiDialog>
  </dialog>
</template>

<style scoped>
.poker-focus {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100dvh;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: #f6f8fb;
  color: #10214d;
  overflow: hidden;
}
.focus-frame { display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; height: 100%; }
.focus-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem clamp(1rem, 4vw, 3rem); border-bottom: 1px solid #e0e6ed; background: white; }
.focus-task { width: min(100%, 960px); margin: 0 auto; padding: 1rem 1.25rem 0; }
.focus-title { height: 5rem; overflow-y: auto; overflow-wrap: anywhere; font-size: clamp(1rem, 2.4vw, 1.5rem); font-weight: 750; line-height: 1.8; }
.focus-title:focus-visible { outline-offset: 2px; }
.focus-body { display: flex; flex-direction: column; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable both-edges; padding: 1.25rem; }
.focus-stage { width: min(100%, 760px); margin: auto; }
.poker-deck { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: clamp(.5rem, 1.5vw, 1rem); max-width: 640px; margin: 0 auto; }
.poker-card { position: relative; display: flex; align-items: center; justify-content: center; height: clamp(76px, 15dvh, 118px); border: 2px solid #d8e1e9; border-radius: 14px; background: white; color: #10214d; font-size: clamp(1.25rem, 3.4vw, 2rem); font-weight: 750; transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease; }
.poker-card:hover:not(:disabled) { border-color: #07846b; background: #ecfcf7; }
.poker-card.is-selected { border-color: #07846b; background: #07846b; color: white; }
.poker-card.is-selected:hover:not(:disabled) { background: #076a58; }
.poker-card:disabled { cursor: default; }
.card-corner, .card-mark { position: absolute; font-size: .65rem; opacity: .55; }
.card-corner { top: .5rem; left: .5rem; }
.card-mark { bottom: .5rem; right: .5rem; }
.is-selected .card-mark { font-size: 1rem; opacity: 1; }
.result-distribution { display: grid; grid-template-columns: repeat(auto-fit, minmax(76px, 1fr)); gap: .75rem; max-width: 640px; margin: 0 auto; }
.focus-footer { position: relative; height: calc(124px + env(safe-area-inset-bottom)); padding: 1rem 1.25rem max(1rem, env(safe-area-inset-bottom)); border-top: 1px solid #e0e6ed; background: white; }
.focus-error { position: absolute; bottom: calc(100% + .5rem); inset-inline: 1rem; }
@media (max-width: 639px) {
  .focus-header { padding: .75rem 1rem; gap: .5rem; }
  .focus-task { padding-top: .75rem; }
  .focus-body { padding: 1rem; }
  .focus-title { height: 3.6rem; }
  .focus-footer { height: calc(168px + env(safe-area-inset-bottom)); padding-top: .75rem; }
  .focus-actions { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .focus-actions > div { width: auto; }
  .focus-accept { grid-column: 1 / -1; }
}
@media (max-height: 600px) {
  .focus-header { padding-block: .5rem; }
  .focus-task { padding-top: .5rem; }
  .focus-title { height: 2.7rem; font-size: 1rem; }
  .focus-footer { height: calc(100px + env(safe-area-inset-bottom)); padding-block: .5rem; overflow-y: auto; }
}
@media (prefers-reduced-motion: reduce) { .poker-card { transition: none; } }
</style>
