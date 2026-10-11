<script setup lang="ts">
import type { PokerSnapshot } from '#shared/models'
import { cardLabel, numericVotes } from '#shared/scrum'

const props = defineProps<{ snapshot: PokerSnapshot; busy: boolean }>()
const emit = defineEmits<{ action: [action: string, fields?: Record<string, unknown>] }>()
const current = computed(() => props.snapshot.tasks.find((task) => task.position === props.snapshot.session.activePosition))
const votes = computed(() => current.value?.votes.filter((vote) => vote.round === current.value?.round) ?? [])
const statistics = computed(() => numericVotes(votes.value.map((vote) => vote.value)))
const voted = computed(() => props.snapshot.participants.filter((person) => person.hasVoted).length)
const point = ref(3)
watch(() => [props.snapshot.session.status, current.value?.id, current.value?.round], () => {
  if (props.snapshot.session.status !== 'reveal') return
  const choices = props.snapshot.session.cards.filter((value) => /^\d+$/.test(value)).map(Number)
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
      <div class="my-6 flex items-center justify-between rounded-xl bg-canvas px-4 py-4"><span class="text-sm font-bold">{{ voted.toLocaleString('fa-IR') }} / {{ snapshot.participants.length.toLocaleString('fa-IR') }} رأی</span><span class="text-xs text-muted">{{ snapshot.me.vote === null ? 'نوبت نگاه شماست' : `کارت شما: ${cardLabel(snapshot.me.vote)}` }}</span></div>
      <fieldset :disabled="busy || snapshot.session.status !== 'voting'"><legend class="sr-only">انتخاب کارت</legend><div class="grid grid-cols-3 gap-3 sm:grid-cols-5" dir="ltr"><button v-for="card in snapshot.session.cards" :key="card" type="button" class="h-22 flex items-center justify-center rounded-2xl border-2 text-2xl font-bold transition-transform duration-150 enabled:hover:-translate-y-0.5 disabled:cursor-default sm:h-24" :class="snapshot.me.vote === card ? 'scale-[1.03] border-brand-600 bg-brand-50 text-brand-700' : 'border-line bg-white'" :aria-pressed="snapshot.me.vote === card" :aria-label="card === 'coffee' ? 'نیاز به استراحت' : card === '?' ? 'نیاز به توضیح بیشتر' : `برآورد ${card}`" @click="emit('action', 'vote', { taskId: current.id, value: card })"><Icon v-if="card === 'coffee'" name="lucide:coffee" aria-hidden="true" /><template v-else>{{ card }}</template></button></div></fieldset>
      <p class="mt-4 text-xs leading-7 text-muted">{{ snapshot.session.status === 'voting' ? 'تا زمان نمایش کارت‌ها می‌توانید رأی خود را عوض کنید. ? یعنی توضیح بیشتر و ☕ یعنی استراحت.' : 'رأی‌گیری بسته شده است؛ حالا گفت‌وگو کنید و تخمین نهایی را انتخاب کنید.' }}</p>
      <template v-if="snapshot.session.status === 'reveal'">
        <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3"><div v-for="metric in [{ label: 'میانه', value: statistics.median }, { label: 'میانگین', value: statistics.average }, { label: 'دامنه اختلاف', value: statistics.range }, { label: 'کمترین', value: statistics.low }, { label: 'بیشترین', value: statistics.high }, { label: 'رأی عددی', value: statistics.count }]" :key="metric.label" class="rounded-xl border border-line bg-canvas p-4"><p class="text-xs text-muted">{{ metric.label }}</p><p class="mt-2 text-2xl font-bold">{{ metric.value === null ? '—' : metric.value.toLocaleString('fa-IR', { maximumFractionDigits: 1 }) }}</p></div></div>
        <ul class="mt-5 space-y-2"><li v-for="vote in votes" :key="vote.userId" class="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm"><span class="min-w-0 flex-1 break-words">{{ vote.name }}</span><span v-if="statistics.range && /^\d+$/.test(vote.value) && Number(vote.value) === statistics.low" class="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700">کمترین</span><span v-if="statistics.range && /^\d+$/.test(vote.value) && Number(vote.value) === statistics.high" class="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">بیشترین</span><span class="min-w-8 text-center text-lg font-bold" dir="ltr">{{ cardLabel(vote.value) }}</span></li></ul>
        <p v-if="statistics.disagreement" class="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-4 text-xs leading-7 text-amber-800"><Icon name="lucide:message-circle-question" class="shrink-0 text-lg" aria-hidden="true" />اختلاف نگاه قابل توجه است؛ قبل از پذیرش، ابهام‌ها را روشن کنید.</p>
      </template>
      <div v-if="snapshot.me.facilitator" class="mt-7 border-t border-line pt-5"><button v-if="snapshot.session.status === 'voting'" class="button-primary w-full" :disabled="busy || voted === 0" @click="emit('action', 'reveal')"><Icon name="lucide:eye" aria-hidden="true" /> نمایش رأی‌ها</button><template v-else><form class="flex flex-wrap items-end gap-3" @submit.prevent="emit('action', 'accept', { point, taskId: current.id })"><label class="min-w-28 flex-1 text-sm font-bold">تخمین نهایی<input v-model.number="point" class="field mt-2" type="number" required min="0" max="100" step="1" :disabled="busy" /></label><button class="button-primary" :disabled="busy">ذخیره و {{ snapshot.tasks.some((task) => task.id !== current?.id && task.status !== 'estimated') ? 'کار بعدی' : 'بازبینی تخمین‌ها' }}<Icon name="lucide:arrow-left" aria-hidden="true" /></button></form><button class="button-secondary mt-4 text-sm" :disabled="busy" @click="emit('action', 'revote', { taskId: current.id })"><Icon name="lucide:rotate-ccw" aria-hidden="true" /> رأی‌گیری دوباره</button></template></div>
      <p v-else class="mt-6 border-t border-line pt-5 text-center text-xs leading-7 text-muted">تسهیل‌گر زمان نمایش کارت‌ها و پذیرش تخمین را مشخص می‌کند.</p>
    </template>
  </section>
</template>
