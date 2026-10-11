<script setup lang="ts">
const props = defineProps<{ title: string; drawer?: boolean }>()
const open = defineModel<boolean>({ default: false })
const dialog = ref<HTMLDialogElement>()
const titleId = useId()
watch([open, dialog], () => {
  if (!dialog.value) return
  if (open.value && !dialog.value.open) dialog.value.showModal()
  if (!open.value && dialog.value.open) dialog.value.close()
}, { flush: 'post' })
function backdrop(event: MouseEvent) {
  const element = dialog.value
  if (!element || event.target !== element) return
  const rect = element.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) open.value = false
}
</script>

<template>
  <dialog ref="dialog" :aria-labelledby="titleId" class="panel mx-auto my-auto w-[min(640px,calc(100vw-32px))] overflow-y-auto p-0" :class="props.drawer ? 'drawer' : ''" @cancel.prevent="open = false" @close="open = false" @click="backdrop">
    <div class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-white px-6 py-4">
      <h2 :id="titleId" class="text-lg font-bold">{{ title }}</h2>
      <button type="button" class="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-canvas" aria-label="بستن" @click="open = false"><Icon name="lucide:x" aria-hidden="true" /></button>
    </div>
    <div v-if="open" class="p-6"><slot /></div>
  </dialog>
</template>
