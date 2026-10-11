<script setup lang="ts">
import type { RoomSnapshot } from '../../shared/poker'
import { voteLabel, voteValues } from '../../shared/poker'

const props = defineProps<{ room: RoomSnapshot }>()
const castVotes = computed(() => props.room.participants.flatMap((person) => person.vote === null ? [] : [person.vote]))
const distribution = computed(() => voteValues.map((value) => ({
  value,
  count: castVotes.value.filter((vote) => vote === value).length,
})).filter((group) => group.count > 0))
const average = computed(() => {
  const numeric = castVotes.value.filter((value) => value !== '?' && value !== 'coffee').map(Number)
  return numeric.length ? (numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toLocaleString('fa-IR', { maximumFractionDigits: 1 }) : '—'
})
const agreement = computed(() => castVotes.value.length > 1 && new Set(castVotes.value).size === 1)
</script>

<template>
  <section aria-live="polite" class="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h3 class="flex items-center gap-2 font-bold text-brand-700">
          <Icon :name="agreement ? 'lucide:party-popper' : 'lucide:chart-no-axes-column'" aria-hidden="true" />
          {{ agreement ? 'هم‌نظر هستید!' : 'کارت‌ها روی میز هستند' }}
        </h3>
        <p class="mt-2 text-xs leading-7 text-muted">{{ castVotes.length ? 'درباره تفاوت برآوردها صحبت کنید؛ میانگین فقط راهنمای گفت‌وگوست.' : 'هنوز رأیی ثبت نشده است. میزبان می‌تواند رأی‌گیری را تکرار کند.' }}</p>
      </div>
      <div class="rounded-xl bg-white px-4 py-3 text-center">
        <p class="text-2xl font-bold">{{ average }}</p>
        <p class="mt-1 text-xs text-muted">میانگین رأی‌های عددی</p>
      </div>
    </div>
    <ul v-if="distribution.length" class="mt-5 flex flex-wrap gap-2" aria-label="توزیع رأی‌ها">
      <li v-for="group in distribution" :key="group.value" class="flex items-center gap-3 rounded-xl border border-brand-100 bg-white px-4 py-2 text-sm">
        <span dir="ltr" class="text-lg font-bold">{{ voteLabel(group.value) }}</span>
        <span class="text-muted">{{ group.count.toLocaleString('fa-IR') }} نفر</span>
      </li>
    </ul>
  </section>
</template>
