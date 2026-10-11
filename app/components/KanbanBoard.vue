<script setup lang="ts">
import { useId } from 'vue'
import type { ProjectOverview, Task } from '#shared/models'
import type { TaskStatus } from '#shared/scrum'
import { statusLabels, taskStatuses } from '#shared/scrum'

const props = defineProps<{ project: ProjectOverview; sprintId: string }>()
const emit = defineEmits<{ open: [id: string] }>()
const { busy, run } = useAction()
const board = ref<HTMLElement | null>(null)
const instructionsId = useId()
const pending = shallowRef<{ id: string; status: TaskStatus } | null>(null)
const blocked = computed(() => busy.value || pending.value !== null)
const colors = { todo: 'bg-slate-400', in_progress: 'bg-blue-500', review: 'bg-amber-500', done: 'bg-brand-500' }
const icons = { todo: 'lucide:circle-dashed', in_progress: 'lucide:circle-dot', review: 'lucide:scan-eye', done: 'lucide:circle-check' }
const items = computed(() => props.project.tasks
  .filter((task) => task.sprintId === props.sprintId)
  .map((task) => pending.value?.id === task.id ? { ...task, status: pending.value.status } : task))
const columns = computed(() => taskStatuses.map((status) => ({ status, tasks: items.value.filter((task) => task.status === status) })))
const { drag, announcement, grab, handleKey, cancel } = useKanbanDrag({ board, blocked, move: change })
const ghostStyle = computed(() => drag.value ? {
  width: `${drag.value.width}px`,
  transform: `translate3d(${drag.value.x - drag.value.offsetX}px, ${drag.value.y - drag.value.offsetY}px, 0) scale(${drag.value.settling ? 1 : 1.025})`,
} : {})

function assignee(task: Task) {
  return props.project.members.find((member) => member.id === task.assigneeId)?.name ?? 'بدون مسئول'
}

async function change(id: string, status: TaskStatus) {
  const task = items.value.find((item) => item.id === id)
  if (!task || task.status === status || blocked.value) return false
  const projectId = props.project.project.id
  const update = { id, status }
  pending.value = update
  announcement.value = `${task.title} به ستون ${statusLabels[status]} منتقل شد؛ در حال ذخیره.`
  let saved = false
  const success = await run(async () => {
    await $fetch(`/api/projects/${projectId}/tasks/${id}`, { method: 'PATCH', body: { status, revision: task.revision } })
    saved = true
    await refreshProject(projectId)
    await nextTick()
    if (pending.value === update && !props.project.tasks.some((item) => item.id === id && item.status === status)) {
      throw new Error('وضعیت ذخیره شد؛ برای ادامهٔ جابه‌جایی، بورد را تازه کنید.')
    }
  })
  if (pending.value !== update) return success
  // A refresh failure must not undo a status already accepted by the server.
  if (success || !saved) pending.value = null
  announcement.value = success ? `${task.title} در ستون ${statusLabels[status]} ذخیره شد.`
    : saved ? 'وضعیت ذخیره شد؛ دریافت اطلاعات تازه ناموفق بود.' : 'ذخیره ناموفق بود؛ کارت به ستون قبلی برگشت.'
  return success
}

watch([() => props.project.project.id, () => props.sprintId], () => { cancel(); pending.value = null })
watch(() => props.project.tasks, () => {
  const update = pending.value
  if (update && !busy.value && props.project.tasks.some((task) => task.id === update.id && task.status === update.status)) pending.value = null
  if (drag.value && !items.value.some((task) => task.id === drag.value?.task.id)) cancel()
})
</script>

<template>
  <div>
    <p :id="instructionsId" class="mb-3 flex items-start gap-2 text-xs leading-6 text-muted">
      <Icon name="lucide:grip-vertical" class="mt-1 shrink-0 text-base" aria-hidden="true" />
      <span>برای تغییر وضعیت، دستگیرهٔ کارت را بگیرید و روی ستون مقصد رها کنید.<span class="sr-only"> با صفحه‌کلید: فاصله یا اینتر برای انتخاب، کلیدهای جهت برای تغییر ستون، فاصله یا اینتر برای انتقال و Escape برای لغو.</span></span>
    </p>
    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
    <div ref="board" class="kanban-board grid items-stretch gap-4 overflow-x-auto pb-4"
      :class="{ 'kanban-dragging': drag?.active }" role="region" aria-label="تابلوی اسپرینت" :aria-describedby="instructionsId">
      <section v-for="column in columns" :key="column.status" :data-status="column.status"
        class="kanban-column relative min-h-80 min-w-0 rounded-[18px] border border-line bg-[#eef2f6] p-3"
        :class="{ 'kanban-column-target': drag?.active && drag.over === column.status && !drag.settling }"
        :aria-label="statusLabels[column.status]">
        <h2 class="mb-3 flex items-center gap-2 px-1 py-2 text-sm font-bold">
          <span class="h-2 w-2 shrink-0 rounded-full" :class="colors[column.status]" />
          {{ statusLabels[column.status] }}
          <span class="mr-auto rounded-lg border border-line bg-white px-2.5 py-1 text-xs text-muted">{{ column.tasks.length.toLocaleString('fa-IR') }}</span>
        </h2>
        <div class="drop-cue flex items-center justify-center gap-2 rounded-xl border border-dashed border-brand-500 bg-brand-50 px-2 text-xs font-medium text-brand-700"
          :class="{ 'drop-cue-visible': drag?.active && drag.over === column.status && !drag.settling }" aria-hidden="true">
          <Icon name="lucide:move" /> رها در: {{ statusLabels[column.status] }}
        </div>
        <TransitionGroup name="kanban-card" tag="div" class="relative space-y-3">
          <KanbanTaskCard v-for="task in column.tasks" :key="task.id" :task="task" :assignee="assignee(task)"
            :instructions-id="instructionsId" :unavailable="blocked || (!!drag && drag.task.id !== task.id)" :moving="drag?.active && drag.task.id === task.id"
            @open="emit('open', $event)" @grab="grab" @handle-key="handleKey" />
        </TransitionGroup>
        <div v-if="!column.tasks.length" class="flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-3 py-8 text-center text-xs leading-7 text-muted">
          <Icon :name="icons[column.status]" class="text-2xl opacity-60" aria-hidden="true" />
          <p>{{ column.status === 'done' ? 'جای اولین کار انجام‌شده اینجاست' : 'کارها را اینجا رها کنید' }}</p>
        </div>
      </section>
    </div>
    <Teleport to="body">
      <div v-if="drag?.active" class="kanban-ghost" :class="{ 'kanban-ghost-keyboard': drag.pointerId === null, 'kanban-ghost-settling': drag.settling }" :style="ghostStyle" dir="rtl" aria-hidden="true">
        <KanbanTaskCard :task="drag.task" :assignee="assignee(drag.task)" preview />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.kanban-board {
  grid-template-columns: repeat(4, minmax(264px, 1fr));
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  scrollbar-color: #bac9d6 transparent;
}
.kanban-column { scroll-snap-align: start; transition: border-color 160ms ease, background-color 160ms ease; }
.kanban-column-target { border-color: #17b995; background: #ecfcf7; }
.kanban-dragging { scroll-snap-type: none; user-select: none; }
.drop-cue {
  position: absolute;
  inset-inline: 12px;
  top: 12px;
  height: 44px;
  z-index: 1;
  pointer-events: none;
  opacity: 0;
  transition: opacity 160ms ease;
}
.drop-cue-visible { opacity: 1; }
.kanban-ghost {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 100;
  pointer-events: none;
  transform-origin: center;
  will-change: transform;
}
.kanban-ghost-keyboard { transition: transform 160ms cubic-bezier(.2, .8, .2, 1); }
.kanban-ghost-settling { transition: transform 180ms cubic-bezier(.2, .8, .2, 1); }
.kanban-card-move, .kanban-card-enter-active, .kanban-card-leave-active {
  transition: transform 180ms cubic-bezier(.2, .8, .2, 1), opacity 180ms ease;
}
.kanban-card-enter-from, .kanban-card-leave-to { opacity: 0; transform: translateY(8px) scale(.98); }
.kanban-card-enter-from.task-card-moving { transform: none; }
.kanban-card-leave-active { position: absolute; width: 100%; }
@media (max-width: 639px) {
  .kanban-board { grid-template-columns: repeat(4, minmax(264px, 84vw)); }
}
</style>
