<script setup lang="ts">
import type { SprintMetrics } from '../../shared/scrum'
import { persianDate, todayInTehran } from '../../shared/calendar'

const props = defineProps<{ metrics: SprintMetrics }>()
const today = todayInTehran()
const ceiling = computed(() => Math.max(props.metrics.total, ...props.metrics.chart.map((point) => point.actual), 1))
const x = (index: number) => 40 + index * 620 / Math.max(props.metrics.chart.length - 1, 1)
const y = (value: number) => 190 - value * 160 / ceiling.value
const expected = computed(() => props.metrics.chart.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point.expected)}`).join(' '))
const actual = computed(() => props.metrics.chart.map((point, index) => ({ ...point, index })).filter((point) => point.date <= today)
  .map((point, index, points) => index ? `H${x(point.index)}V${y(point.actual)}` : `M${x(point.index)},${y(points[0]?.actual ?? 0)}`).join(' '))
</script>

<template>
  <section class="panel p-5">
    <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="font-bold">پیشرفت در مسیر اسپرینت</h2><div class="flex gap-4 text-xs text-muted"><span class="flex items-center gap-2"><span class="h-0.5 w-5 bg-slate-400" /> انتظار</span><span class="flex items-center gap-2"><span class="h-0.5 w-5 bg-brand-600" /> واقعی</span></div></div>
    <svg viewBox="0 0 700 230" class="mt-4 w-full" role="img" :aria-label="`پیشرفت اسپرینت: ${metrics.done} پوینت انجام شده از ${metrics.total}؛ انتظار ${metrics.expected.toFixed(1)} پوینت`" dir="ltr">
      <g v-for="fraction in [0, 0.5, 1]" :key="fraction"><line x1="40" x2="660" :y1="y(ceiling * fraction)" :y2="y(ceiling * fraction)" stroke="#e0e6ed" /><text x="30" :y="y(ceiling * fraction) + 4" text-anchor="end" fill="#627084" font-size="11">{{ Math.round(ceiling * fraction).toLocaleString('fa-IR') }}</text></g>
      <path :d="expected" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="5 5" />
      <path :d="actual" fill="none" stroke="#07846b" stroke-width="3" stroke-linejoin="round" />
      <text x="40" y="217" fill="#627084" font-size="11">{{ metrics.chart[0] ? persianDate(metrics.chart[0].date, true) : '' }}</text>
      <text x="660" y="217" text-anchor="end" fill="#627084" font-size="11">{{ metrics.chart.at(-1) ? persianDate(metrics.chart.at(-1)!.date, true) : '' }}</text>
    </svg>
    <p class="text-xs leading-7 text-muted">خط واقعی فقط با Done شدن کارها تغییر می‌کند؛ تغییر پوینت و بازگشایی کار نیز در تاریخ خود ثبت می‌شوند.</p>
  </section>
</template>
