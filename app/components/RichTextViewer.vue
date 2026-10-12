<script setup lang="ts">
import { markdownToDocument, renderRichText } from '~/utils/rich-text'

const props = defineProps<{ content: string }>()
const document = computed(() => markdownToDocument(props.content))
const Content = () => renderRichText(document.value)
</script>

<template>
  <div class="rich-text text-sm" dir="auto"><Content /></div>
</template>
