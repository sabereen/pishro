<script setup lang="ts">
definePageMeta({ layout: 'project', middleware: 'auth', key: (route) => route.path })
const route = useRoute()
const projectId = String(route.params.projectId)
const sprintId = String(route.params.sprintId)
</script>

<template>
  <div class="mb-6">
    <NuxtLink :to="`/projects/${projectId}/sprint`" class="text-xs text-muted"
      ><Icon name="lucide:arrow-right" aria-hidden="true" /> اسپرینت‌ها</NuxtLink
    >
    <h1 class="mt-3 text-2xl font-bold">انتخاب کار با تیم</h1>
  </div>
  <TaskPicking :project-id="projectId" :sprint-id="sprintId" />
</template>
