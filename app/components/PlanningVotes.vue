<script setup lang="ts">
import type { PokerSnapshot } from '#shared/models'
import { cardLabel, isNumericCard, numericVotes } from '#shared/scrum'

const props = defineProps<{ snapshot: PokerSnapshot; busy: boolean }>()
const emit = defineEmits<{ action: [action: string, fields?: Record<string, unknown>] }>()
const current = computed(() => props.snapshot.tasks.find((task) => task.position === props.snapshot.session.activePosition))
const votes = computed(() => current.value?.votes.filter((vote) => vote.round === current.value?.round) ?? [])
const statistics = computed(() => numericVotes(votes.value.map((vote) => vote.value)))
const voted = computed(() => props.snapshot.participants.filter((person) => person.hasVoted).length)
const waiting = computed(() => props.snapshot.participants.filter((person) => !person.hasVoted && !person.ignored))
const eligible = computed(() => props.snapshot.participants.filter((person) => !person.ignored))
const selectedPerson = ref<string | null>(null)
const ignoredMe = computed(() => props.snapshot.participants.find((person) => person.id === props.snapshot.me.id)?.ignored)
const point = ref(3)
watch(() => [props.snapshot.session.status, current.value?.id, current.value?.round], () => {
  if (props.snapshot.session.status !== 'reveal') return
  const choices = props.snapshot.session.cards.filter(isNumericCard).map(Number)
  const median = statistics.value.median ?? 3
  point.value = choices.sort((a, b) => Math.abs(a - median) - Math.abs(b - median))[0] ?? 3
}, { immediate: true })
</script>

<template>
  <section class="panel min-w-0 p-5 sm:p-7">
    <template v-if="current">
      <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><span class="rounded-lg bg-canvas px-3 py-2">کار {{ (current.position + 1).toLocaleString('fa-IR') }} از {{ snapshot.tasks.length.toLocaleString('fa-IR') }} · دور {{ current.round.toLocaleString('fa-IR') }}</span><span class="flex items-center gap-2"><Icon :name="snapshot.session.status === 'reveal' ? 'lucide:eye' : 'lucide:eye-off'" aria-hidden="true" />{{ snapshot.session.status === 'reveal' ? 'کارت‌ها رو شدند' : 'رأی‌ها مستقل و پنهان' }}</span></div>
      <h2 class="mt-6 break-words text-xl font-bold leading-10 sm:text-2xl">{{ current.title }}</h2>
      <p class="mt-3 text-sm leading-8 text-muted">{{ snapshot.session.status === 'reveal' ? 'تفاوت برآوردها را ببینید؛ از کوچک‌ترین و بزرگ‌ترین رأی شروع کنید.' : 'حجم کار، پیچیدگی و ابهام را در نظر بگیرید؛ کدام کارت برآورد شماست؟' }}</p>
      <div class="my-6 flex items-center justify-between rounded-xl bg-canvas px-4 py-4"><span class="text-sm font-bold">{{ voted.toLocaleString('fa-IR') }} / {{ eligible.length.toLocaleString('fa-IR') }} رأی</span><span class="text-xs text-muted">{{ current.revoteRequired ? 'نیاز به رأی‌گیری مجدد' : ignoredMe ? 'این دور بدون رأی شما ادامه می‌یابد' : snapshot.me.vote === null ? 'نوبت نگاه شماست' : `کارت شما: ${cardLabel(snapshot.me.vote)}` }}</span></div>
      <Transition name="round-state" mode="out-in">
        <section v-if="snapshot.session.status === 'voting'" :key="`${current.id}:${current.round}:waiting`" class="mb-6 rounded-2xl border border-line bg-canvas p-5" aria-labelledby="waiting-title">
          <div class="flex items-center gap-3"><span class="waiting-beacon h-10 w-10 flex shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon name="lucide:hourglass" aria-hidden="true" /></span><div class="min-w-0 flex-1"><h3 id="waiting-title" class="font-bold">در انتظار رأی تیم</h3><p class="mt-1 text-xs leading-6 text-muted" role="status" aria-live="polite">{{ waiting.length.toLocaleString('fa-IR') }} نفر باقی مانده؛ با آخرین رأی، نتیجه برای همه مشخص می‌شود.</p></div></div>
          <div class="mt-4 h-1.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-label="پیشرفت رأی‌گیری" :aria-valuenow="voted" :aria-valuemax="eligible.length" :aria-valuemin="0"><div class="vote-progress h-full rounded-full bg-brand-500" :style="{ width: `${eligible.length ? voted / eligible.length * 100 : 100}%` }" /></div>
          <TransitionGroup name="waiting-person" tag="ul" class="waiting-list relative mt-4 space-y-2">
            <li v-for="person in waiting" :key="`${current.id}:${current.round}:${person.id}`" class="rounded-xl border border-line bg-white p-3">
              <button v-if="snapshot.me.facilitator" type="button" class="w-full flex items-center gap-3 text-start" :aria-expanded="selectedPerson === person.id" :disabled="busy" @click="selectedPerson = selectedPerson === person.id ? null : person.id"><UserAvatar :name="person.name" :src="person.avatarUrl" :size="36" /><span class="min-w-0 flex-1 break-words text-sm font-bold">{{ person.name }}</span><Icon name="lucide:ellipsis" class="text-muted" aria-hidden="true" /></button>
              <div v-else class="flex items-center gap-3"><UserAvatar :name="person.name" :src="person.avatarUrl" :size="36" /><span class="break-words text-sm font-bold">{{ person.name }}</span></div>
              <Transition name="round-state"><div v-if="snapshot.me.facilitator && selectedPerson === person.id" class="mt-3 border-t border-line pt-3"><button type="button" class="button-secondary w-full text-xs" :disabled="busy" @click="emit('action', 'ignore', { taskId: current.id, userId: person.id }); selectedPerson = null"><Icon name="lucide:user-minus" aria-hidden="true" />Ignore · ادامه بدون رأی {{ person.name }}</button><p class="mt-2 text-xs leading-6 text-muted">فقط برای همین دور؛ در رأی‌گیری بعدی دوباره شرکت می‌کند.</p></div></Transition>
            </li>
          </TransitionGroup>
          <p v-if="snapshot.me.facilitator" class="mt-4 text-xs leading-7 text-muted">برای ادامه بدون رأی یک نفر، نام همان فرد را انتخاب کنید.</p>
        </section>
        <section v-else-if="current.revoteRequired" key="uncertain" class="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5" role="status"><Icon name="lucide:message-circle-question" class="text-3xl text-amber-700" aria-hidden="true" /><h3 class="mt-3 font-bold text-amber-900">اول ابهام‌ها را روشن کنیم</h3><p class="mt-2 text-sm leading-8 text-amber-800">حداقل یک رأی علامت سؤال بود؛ هیچ رأیی نمایش داده نمی‌شود. پس از گفت‌وگو، رأی‌گیری را دوباره شروع کنید.</p><button v-if="snapshot.me.facilitator" class="button-secondary mt-4" :disabled="busy" @click="emit('action', 'revote', { taskId: current.id })"><Icon name="lucide:rotate-ccw" aria-hidden="true" />رأی‌گیری مجدد</button></section>
        <div v-else key="complete" class="round-complete mb-6 flex items-center gap-3 rounded-xl bg-brand-50 p-4 text-sm font-bold text-brand-700" role="status"><Icon name="lucide:circle-check" class="text-xl" aria-hidden="true" />رأی‌گیری کامل شد؛ نتیجه برای همه نمایش داده شد.</div>
      </Transition>
      <fieldset v-if="!current.revoteRequired" :disabled="busy || ignoredMe || snapshot.session.status !== 'voting'"><legend class="sr-only">انتخاب کارت</legend><div class="grid grid-cols-3 gap-3 sm:grid-cols-5" dir="ltr"><button v-for="card in snapshot.session.cards" :key="card" type="button" class="h-22 flex items-center justify-center rounded-2xl border-2 text-2xl font-bold transition-transform duration-150 enabled:hover:-translate-y-0.5 disabled:cursor-default sm:h-24" :class="snapshot.me.vote === card ? 'scale-[1.03] border-brand-600 bg-brand-50 text-brand-700' : 'border-line bg-white'" :aria-pressed="snapshot.me.vote === card" :aria-label="card === 'coffee' ? 'نیاز به استراحت' : card === '?' ? 'نیاز به توضیح بیشتر' : `برآورد ${card}`" @click="emit('action', 'vote', { taskId: current.id, value: card })"><Icon v-if="card === 'coffee'" name="lucide:coffee" aria-hidden="true" /><template v-else>{{ card }}</template></button></div></fieldset>
      <p class="mt-4 text-xs leading-7 text-muted">{{ snapshot.session.status === 'voting' ? 'تا زمان نمایش کارت‌ها می‌توانید رأی خود را عوض کنید. ? یعنی توضیح بیشتر و ☕ یعنی استراحت.' : 'رأی‌گیری بسته شده است؛ حالا گفت‌وگو کنید و تخمین نهایی را انتخاب کنید.' }}</p>
      <template v-if="snapshot.session.status === 'reveal' && !current.revoteRequired">
        <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3"><div v-for="metric in [{ label: 'میانه', value: statistics.median }, { label: 'میانگین', value: statistics.average }, { label: 'دامنه اختلاف', value: statistics.range }, { label: 'کمترین', value: statistics.low }, { label: 'بیشترین', value: statistics.high }, { label: 'رأی عددی', value: statistics.count }]" :key="metric.label" class="rounded-xl border border-line bg-canvas p-4"><p class="text-xs text-muted">{{ metric.label }}</p><p class="mt-2 text-2xl font-bold">{{ metric.value === null ? '—' : metric.value.toLocaleString('fa-IR', { maximumFractionDigits: 2 }) }}</p></div></div>
        <ul class="mt-5 space-y-2"><li v-for="vote in votes" :key="vote.userId" class="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm"><UserAvatar :name="vote.name" :src="snapshot.participants.find((person) => person.id === vote.userId)?.avatarUrl" :size="32" /><span class="min-w-0 flex-1 break-words">{{ vote.name }}</span><span v-if="statistics.range && isNumericCard(vote.value) && Number(vote.value) === statistics.low" class="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700">کمترین</span><span v-if="statistics.range && isNumericCard(vote.value) && Number(vote.value) === statistics.high" class="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">بیشترین</span><span class="min-w-8 text-center text-lg font-bold" dir="ltr">{{ cardLabel(vote.value) }}</span></li></ul>
        <p v-if="statistics.disagreement" class="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-4 text-xs leading-7 text-amber-800"><Icon name="lucide:message-circle-question" class="shrink-0 text-lg" aria-hidden="true" />اختلاف نگاه قابل توجه است؛ قبل از پذیرش، ابهام‌ها را روشن کنید.</p>
      </template>
      <div v-if="snapshot.me.facilitator && snapshot.session.status === 'reveal' && !current.revoteRequired" class="mt-7 border-t border-line pt-5"><form class="flex flex-wrap items-end gap-3" @submit.prevent="emit('action', 'accept', { point, taskId: current.id })"><label class="min-w-28 flex-1 text-sm font-bold">تخمین نهایی<input v-model.number="point" class="field mt-2" type="number" required min="0" max="100" step="0.5" :disabled="busy" /></label><button class="button-primary" :disabled="busy">ذخیره و {{ snapshot.tasks.some((task) => task.id !== current?.id && task.status !== 'estimated') ? 'کار بعدی' : 'بازبینی تخمین‌ها' }}<Icon name="lucide:arrow-left" aria-hidden="true" /></button></form><button class="button-secondary mt-4 text-sm" :disabled="busy" @click="emit('action', 'revote', { taskId: current.id })"><Icon name="lucide:rotate-ccw" aria-hidden="true" /> رأی‌گیری دوباره</button></div>
      <p v-else class="mt-6 border-t border-line pt-5 text-center text-xs leading-7 text-muted">نتایج به‌صورت خودکار برای همه نمایش داده می‌شود؛ تسهیل‌گر تخمین نهایی را ثبت می‌کند.</p>
    </template>
  </section>
</template>

<style scoped>
.waiting-person-enter-active, .waiting-person-leave-active, .waiting-person-move { transition: opacity 280ms ease, transform 280ms ease; }
.waiting-person-enter-from { opacity: 0; transform: translateY(10px); }
.waiting-person-leave-to { opacity: 0; transform: translateX(-22px) scale(.96); }
.waiting-person-leave-active { position: absolute; width: 100%; }
.round-state-enter-active, .round-state-leave-active { transition: opacity 220ms ease, transform 220ms ease; }
.round-state-enter-from, .round-state-leave-to { opacity: 0; transform: translateY(8px); }
.vote-progress { transition: width 450ms cubic-bezier(.22, 1, .36, 1); }
.waiting-beacon { animation: waiting-breathe 2.8s ease-in-out infinite; }
.round-complete { animation: result-arrive 400ms ease-out; }
@keyframes waiting-breathe { 50% { transform: scale(.92); opacity: .65; } }
@keyframes result-arrive { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) {
  .waiting-beacon, .round-complete { animation: none; }
  .waiting-person-enter-active, .waiting-person-leave-active, .waiting-person-move, .round-state-enter-active, .round-state-leave-active, .vote-progress { transition: none; }
}
</style>
