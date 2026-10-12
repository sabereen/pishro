<script setup lang="ts">
const props = withDefaults(defineProps<{ name?: string; src?: string | null; size?: number }>(), {
  name: '',
  src: null,
  size: 40,
})
const image = shallowRef<HTMLImageElement>()
const loaded = ref(false)
const failed = ref(false)
const initials = computed(() =>
  props.name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => [...part][0] ?? '')
    .join('')
    .toUpperCase(),
)
// SSR images may finish loading before Vue attaches its event listeners.
onMounted(() => {
  if (image.value?.complete) {
    loaded.value = image.value.naturalWidth > 0
    failed.value = !loaded.value
  }
})
watch(
  () => props.src,
  () => {
    loaded.value = false
    failed.value = false
  },
)
</script>

<template>
  <span
    class="user-avatar relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 font-bold text-brand-700"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.32)}px` }"
    aria-hidden="true"
  >
    <span v-if="initials" dir="auto">{{ initials }}</span>
    <Icon v-else name="lucide:user-round" aria-hidden="true" />
    <img
      ref="image"
      v-if="src && !failed"
      :key="src"
      :src="src"
      alt=""
      :width="size"
      :height="size"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      class="absolute inset-0 h-full w-full object-cover transition-opacity duration-150"
      :class="loaded ? 'opacity-100' : 'opacity-0'"
      @load="loaded = true"
      @error="failed = true"
    />
  </span>
</template>

<style scoped>
.user-avatar {
  box-shadow: inset 0 0 0 1px rgb(7 132 107 / 8%);
}
</style>
