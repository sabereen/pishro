<script setup lang="ts">
const { toasts } = useToasts()
</script>

<template>
  <TransitionGroup
    name="ui-toast"
    tag="div"
    class="fixed bottom-5 left-5 z-100 w-[min(380px,calc(100vw-40px))]"
    aria-live="polite"
    aria-relevant="additions text"
  >
    <div v-for="item in toasts" :key="item.id" class="ui-toast-entry">
      <div class="min-h-0 overflow-hidden">
        <div
          class="mt-2 flex items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm"
          :class="
            item.tone === 'error'
              ? 'border-red-200 text-red-700'
              : 'border-brand-100 text-brand-700'
          "
        >
          <Icon
            :name="item.tone === 'error' ? 'lucide:circle-alert' : 'lucide:circle-check'"
            class="shrink-0"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 break-words leading-7">{{ item.message }}</span>
          <button
            type="button"
            class="h-11 w-8 flex shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-canvas"
            aria-label="بستن پیام"
            @click="toasts = toasts.filter((toast) => toast.id !== item.id)"
          >
            <Icon name="lucide:x" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </TransitionGroup>
</template>
