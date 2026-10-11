<script setup lang="ts">
defineProps<{ point: number | null }>()
</script>

<template><span class="inline-flex min-w-7 items-center justify-center rounded-lg border border-line bg-canvas px-2 py-1 text-xs font-bold tabular-nums" :aria-label="point === null ? 'بدون تخمین' : `${point} پوینت`">{{ point === null ? '—' : point.toLocaleString('fa-IR') }}</span></template>
