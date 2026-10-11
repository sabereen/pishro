<script setup lang="ts">
defineProps<{ title: string; description: string; icon?: string }>()
</script>

<template>
  <div class="panel px-6 py-12 text-center">
    <span class="mx-auto h-14 w-14 flex items-center justify-center rounded-2xl bg-brand-50 text-2xl text-brand-700"><Icon :name="icon ?? 'lucide:sprout'" aria-hidden="true" /></span>
    <h2 class="mt-5 text-xl font-bold">{{ title }}</h2>
    <p class="mx-auto mt-3 max-w-md text-sm leading-8 text-muted">{{ description }}</p>
    <div class="mt-6"><slot /></div>
  </div>
</template>
