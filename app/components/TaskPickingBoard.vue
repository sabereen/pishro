<script setup lang="ts">
import type { TaskPickingSnapshot } from '#shared/models'

const props = defineProps<{ snapshot: TaskPickingSnapshot; busy: boolean }>()
const emit = defineEmits<{ action: [action: 'pick' | 'release', taskId: string] }>()
const columns = computed(() =>
  [{ id: null, name: 'انتخاب‌نشده', avatarUrl: undefined }, ...props.snapshot.members].map((member) => {
    const tasks = props.snapshot.tasks.filter((task) => task.assigneeId === member.id)
    return { ...member, tasks, points: tasks.reduce((sum, task) => sum + (task.point ?? 0), 0) }
  }),
)
const summary = computed(() => {
  const total = props.snapshot.tasks.reduce((sum, task) => sum + (task.point ?? 0), 0)
  const unpicked = columns.value[0]
  return [
    { label: 'کل پوینت اسپرینت', value: total },
    { label: 'پوینت انتخاب‌شده', value: total - (unpicked?.points ?? 0) },
    { label: 'پوینت انتخاب‌نشده', value: unpicked?.points ?? 0 },
    { label: 'کار انتخاب‌نشده', value: unpicked?.tasks.length ?? 0 },
  ]
})
</script>

<template>
  <div class="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="خلاصه انتخاب کار">
    <div v-for="metric in summary" :key="metric.label" class="panel p-4">
      <p class="text-xs leading-6 text-muted">{{ metric.label }}</p>
      <p class="mt-2 text-2xl font-bold">{{ metric.value.toLocaleString('fa-IR') }}</p>
    </div>
  </div>
  <div
    class="grid items-start gap-4 md:flex md:overflow-x-auto md:pb-5"
    aria-label="تابلوی انتخاب کار"
  >
    <section
      v-for="column in columns"
      :key="column.id ?? 'unpicked'"
      class="min-w-0 rounded-[18px] border border-line bg-[#eef2f6] p-3 md:w-72 md:shrink-0"
      :aria-label="column.name"
    >
      <div class="mb-3 flex items-start gap-3 px-1 py-2">
        <UserAvatar v-if="column.id" :name="column.name" :src="column.avatarUrl" />
        <span v-else class="h-10 w-10 flex shrink-0 items-center justify-center rounded-xl bg-white text-muted" aria-hidden="true"><Icon name="lucide:list-todo" /></span>
        <div class="min-w-0">
          <h3 class="break-words text-sm font-bold leading-7">
            {{ column.name
            }}<span v-if="column.id === snapshot.me.id" class="mr-2 text-xs text-brand-700"
              >شما</span
            >
          </h3>
          <p class="text-xs leading-6 text-muted">
            {{ column.tasks.length.toLocaleString('fa-IR') }} کار ·
            {{ column.points.toLocaleString('fa-IR') }} پوینت
          </p>
        </div>
      </div>
      <TransitionGroup name="picking" tag="div" class="min-h-16 space-y-3">
        <article
          v-for="task in column.tasks"
          :key="task.id"
          class="rounded-[14px] border border-line bg-white p-4"
        >
          <h4 class="break-words text-sm font-bold leading-7">{{ task.title }}</h4>
          <div class="mt-3 flex items-center justify-between gap-3">
            <PointBadge :point="task.point" /><button
              v-if="
                snapshot.sprint.status === 'planned' &&
                (column.id === null || column.id === snapshot.me.id)
              "
              class="button-secondary px-3 py-2 text-xs"
              :disabled="busy"
              :aria-label="`${column.id === null ? 'انتخاب' : 'آزاد کردن'} ${task.title}`"
              @click="emit('action', column.id === null ? 'pick' : 'release', task.id)"
            >
              <Icon
                :name="column.id === null ? 'lucide:plus' : 'lucide:undo-2'"
                aria-hidden="true"
              />{{ column.id === null ? 'انتخاب' : 'آزاد کردن' }}
            </button>
          </div>
        </article>
      </TransitionGroup>
      <p
        v-if="!column.tasks.length"
        class="rounded-xl border border-dashed border-line px-3 py-5 text-center text-xs leading-7 text-muted"
      >
        {{ column.id === null ? 'همه کارها انتخاب شده‌اند' : 'هنوز کاری انتخاب نشده' }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.picking-enter-active,
.picking-leave-active {
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}
.picking-enter-from,
.picking-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
@media (prefers-reduced-motion: reduce) {
  .picking-enter-active,
  .picking-leave-active {
    transition: none;
  }
}
</style>
