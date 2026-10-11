<script setup lang="ts">
const { toasts } = useToasts()
</script>

<template>
  <div class="fixed bottom-5 left-5 z-100 max-w-[calc(100vw-40px)] space-y-2" aria-live="polite">
    <div v-for="item in toasts" :key="item.id" class="flex items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm" :class="item.tone === 'error' ? 'border-red-200 text-red-700' : 'border-brand-100 text-brand-700'">
      <Icon :name="item.tone === 'error' ? 'lucide:circle-alert' : 'lucide:circle-check'" class="shrink-0" aria-hidden="true" />
      <span class="max-w-sm leading-7">{{ item.message }}</span>
      <button class="h-11 w-8 flex shrink-0 items-center justify-center" aria-label="بستن پیام" @click="toasts = toasts.filter((toast) => toast.id !== item.id)"><Icon name="lucide:x" aria-hidden="true" /></button>
    </div>
  </div>
</template>
