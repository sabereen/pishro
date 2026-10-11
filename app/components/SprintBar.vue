<script setup lang="ts">
import type { ProjectOverview } from '../../shared/models'

const props = defineProps<{ project: ProjectOverview }>()
const sprint = computed(() => props.project.sprints.find((item) => item.status === 'active'))
const metrics = computed(() => sprint.value ? props.project.metrics[sprint.value.id] : null)
const number = (value: number) => value.toLocaleString('fa-IR', { maximumFractionDigits: 1 })
</script>

<template>
  <section v-if="sprint && metrics" class="panel mb-7 flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4" aria-label="وضعیت اسپرینت فعال">
    <div><p class="text-sm font-bold">{{ sprint.name }}</p><p class="mt-1 text-xs text-muted">روز {{ number(metrics.day) }} از {{ number(metrics.days) }}</p></div>
    <div class="min-w-40 flex-1"><div class="mb-2 flex items-center justify-between text-xs"><span>{{ number(metrics.done) }} / {{ number(metrics.total) }} پوینت</span><span class="text-muted">انتظار {{ number(metrics.expected) }}</span></div><div class="h-2 overflow-hidden rounded-full bg-canvas" role="progressbar" :aria-valuenow="metrics.done" :aria-valuemax="Math.max(metrics.total, 1)" aria-valuemin="0" aria-label="پیشرفت واقعی اسپرینت"><div class="h-full origin-right rounded-full bg-brand-500" :style="{ width: `${Math.min(100, metrics.total ? metrics.done / metrics.total * 100 : 0)}%` }" /></div></div>
    <span class="rounded-lg px-3 py-2 text-xs font-bold" :class="Math.abs(metrics.delta) < 0.5 ? 'bg-canvas text-muted' : metrics.delta > 0 ? 'bg-brand-50 text-brand-700' : metrics.delta >= -Math.max(3, metrics.total * 0.15) ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'">{{ Math.abs(metrics.delta) < 0.5 ? 'هم‌مسیر با برنامه' : `${number(Math.abs(metrics.delta))} پوینت ${metrics.delta > 0 ? 'جلوتر' : 'عقب‌تر'}` }}</span>
  </section>
</template>
