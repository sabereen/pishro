<script setup lang="ts">
const props = defineProps<{ title: string; drawer?: boolean }>()
const open = defineModel<boolean>({ default: false })
const dialog = shallowRef<HTMLDialogElement>()
const titleId = useId()
let previousFocus: HTMLElement | null = null
function show(element: Element) {
  const modal = element as HTMLDialogElement
  if (!modal.isConnected || modal.open) return
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  modal.showModal()
}
function hide(element: Element) {
  const modal = element as HTMLDialogElement
  if (modal.open) modal.close()
  if (!open.value && previousFocus?.isConnected) previousFocus.focus()
}
function closed(event: Event) {
  // A close event from a departing instance must not close a newly opened dialog.
  if (event.target === dialog.value) open.value = false
}
function backdrop(event: MouseEvent) {
  const element = dialog.value
  if (!element || event.target !== element) return
  const rect = element.getBoundingClientRect()
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    open.value = false
}
</script>

<template>
  <Transition name="ui-dialog" appear @enter="show" @after-leave="hide">
    <dialog
      v-if="open"
      ref="dialog"
      :aria-labelledby="titleId"
      class="panel mx-auto my-auto w-[min(640px,calc(100vw-32px))] overflow-y-auto p-0"
      :class="props.drawer ? 'drawer' : ''"
      @cancel.prevent="open = false"
      @close="closed"
      @click="backdrop"
    >
      <div
        class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-white px-6 py-4"
      >
        <h2 :id="titleId" class="text-lg font-bold">{{ title }}</h2>
        <button
          type="button"
          class="h-11 w-11 flex items-center justify-center rounded-lg transition-colors hover:bg-canvas"
          aria-label="بستن"
          @click="open = false"
        >
          <Icon name="lucide:x" aria-hidden="true" />
        </button>
      </div>
      <div class="p-6"><slot /></div>
    </dialog>
  </Transition>
</template>
