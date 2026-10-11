<script setup lang="ts">
import type { TaskPickingSnapshot } from '#shared/models'

const props = defineProps<{ projectId: string; sprintId: string }>()
const { data, error: loadError } = await useFetch<TaskPickingSnapshot>(
  `/api/projects/${props.projectId}/sprints/${props.sprintId}/picking`,
)
const { snapshot, busy, error, connection, action } = useTaskPicking(
  props.projectId,
  props.sprintId,
  data.value ?? null,
)
const { busy: starting, run } = useAction()
const unpicked = computed(
  () => snapshot.value?.tasks.filter((task) => !task.assigneeId).length ?? 0,
)
watch(
  () => JSON.stringify(snapshot.value),
  () => {
    void refreshProject(props.projectId).catch(() => {})
  },
)
async function start() {
  await run(async () => {
    await $fetch(`/api/projects/${props.projectId}/sprints`, {
      method: 'PATCH',
      body: { id: props.sprintId, action: 'start' },
    })
    await refreshProject(props.projectId)
    await navigateTo(`/projects/${props.projectId}/sprint`)
  }, 'اسپرینت شروع شد')
}
</script>

<template>
  <p v-if="loadError || !snapshot" role="alert" class="panel p-6 text-sm leading-8 text-red-700">
    {{ loadError ? requestError(loadError) : 'تابلوی انتخاب کار در دسترس نیست.' }}
  </p>
  <section v-else>
    <div class="panel mb-5 p-5 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold">انتخاب کار · {{ snapshot.sprint.name }}</h2>
          <p class="mt-2 text-sm leading-8 text-muted">
            هر نفر کار خودش را انتخاب می‌کند. برای برگرداندن کار خودتان به ستون انتخاب‌نشده، آن را
            آزاد کنید.
          </p>
        </div>
        <span class="flex items-center gap-2 text-xs text-muted" role="status"
          ><span
            class="h-2 w-2 rounded-full"
            :class="connection === 'connected' ? 'bg-brand-500' : 'bg-amber-500'"
          />{{
            connection === 'connected'
              ? 'همگام با تیم'
              : connection === 'connecting'
                ? 'در حال اتصال…'
                : 'در حال اتصال دوباره…'
          }}</span
        >
      </div>
      <p v-if="snapshot.sprint.status !== 'planned'" class="mt-3 text-sm leading-7 text-muted">
        {{
          snapshot.sprint.status === 'active'
            ? 'اسپرینت شروع شده است؛ انتخاب کار بسته شد.'
            : 'این اسپرینت پایان یافته است.'
        }}<NuxtLink :to="`/projects/${projectId}/sprint`" class="mr-2 text-brand-700"
          >دیدن اسپرینت</NuxtLink
        >
      </p>
    </div>
    <p v-if="error" role="alert" class="mb-4 text-sm leading-7 text-red-700">{{ error }}</p>
    <TaskPickingBoard :snapshot="snapshot" :busy="busy || starting" @action="action" />
    <div
      v-if="snapshot.sprint.status === 'planned'"
      class="mt-5 flex flex-wrap items-center justify-between gap-4"
    >
      <p class="text-xs leading-7 text-muted">
        {{
          unpicked
            ? `${unpicked.toLocaleString('fa-IR')} کار هنوز انتخاب نشده است؛ شروع اسپرینت مجاز است.`
            : 'همه کارهای اسپرینت انتخاب شده‌اند.'
        }}
      </p>
      <button
        v-if="snapshot.me.admin"
        class="button-primary"
        :disabled="busy || starting"
        @click="start"
      >
        شروع اسپرینت<Icon name="lucide:play" aria-hidden="true" />
      </button>
      <p v-else class="text-xs text-muted">مدیر پروژه می‌تواند اسپرینت را شروع کند.</p>
    </div>
  </section>
</template>
