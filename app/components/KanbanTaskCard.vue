<script setup lang="ts">
import type { Task } from '#shared/models'

const props = defineProps<{
  task: Task
  assignee: string
  assigneeAvatar?: string
  instructionsId?: string
  unavailable?: boolean
  moving?: boolean
  preview?: boolean
}>()
const emit = defineEmits<{
  open: [id: string]
  grab: [event: PointerEvent, task: Task]
  handleKey: [event: KeyboardEvent, task: Task]
}>()
const prLabels = { open: 'باز', draft: 'پیش‌نویس', merged: 'ادغام شده', closed: 'بسته' }
</script>

<template>
  <article
    class="task-card rounded-2xl border border-line bg-white p-4"
    :class="{ 'task-card-moving': moving, 'task-card-preview': preview }"
    :data-task-id="preview ? undefined : task.id"
  >
    <div class="mb-3 flex min-h-6 items-center justify-between gap-2">
      <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium"
        :class="task.priority === 'high' ? 'bg-amber-50 text-amber-800' : 'bg-canvas text-muted'">
        <Icon :name="task.priority === 'high' ? 'lucide:flag' : task.priority === 'low' ? 'lucide:arrow-down' : 'lucide:minus'" aria-hidden="true" />
        {{ { high: 'اولویت بالا', normal: 'اولویت عادی', low: 'اولویت پایین' }[task.priority] }}
      </span>
      <div class="flex items-center gap-1.5"><span class="text-[10px] text-muted">پوینت</span><PointBadge :point="task.point" /></div>
    </div>
    <p v-if="preview" class="break-words text-sm font-bold leading-7">{{ task.title }}</p>
    <button v-else type="button" class="w-full break-words text-right text-sm font-bold leading-7 transition-colors hover:text-brand-700" @click="emit('open', task.id)">
      {{ task.title }}
    </button>
    <div v-if="task.pullRequests[0]" class="mt-3 rounded-lg border border-line bg-canvas px-2.5 py-2 text-xs">
      <span v-if="preview" class="flex items-center gap-2 text-muted"><Icon name="lucide:git-pull-request" aria-hidden="true" /><span dir="ltr">PR #{{ task.pullRequests[0].number }}</span><span class="mr-auto">{{ prLabels[task.pullRequests[0].status] }}</span></span>
      <a v-else :href="task.pullRequests[0].url" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 text-muted hover:text-brand-700">
        <Icon name="lucide:git-pull-request" aria-hidden="true" /><span dir="ltr">PR #{{ task.pullRequests[0].number }}</span><span class="mr-auto">{{ prLabels[task.pullRequests[0].status] }}</span>
      </a>
    </div>
    <div class="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
      <div class="flex min-w-0 items-center gap-2">
        <UserAvatar :name="task.assigneeId ? assignee : ''" :src="assigneeAvatar" :size="32" />
        <span class="truncate text-xs text-muted">{{ assignee }}</span>
      </div>
      <span v-if="preview" class="drag-handle drag-handle-active" aria-hidden="true"><Icon name="lucide:grip-vertical" class="text-xl" /></span>
      <button v-else type="button" class="drag-handle" :class="{ 'drag-handle-active': moving }"
        data-drag-handle :aria-disabled="unavailable || undefined" :aria-pressed="!!moving"
        :aria-label="`جابه‌جایی ${task.title}`" :aria-describedby="instructionsId"
        title="برای جابه‌جایی، دستگیره را بکشید" @pointerdown="emit('grab', $event, task)"
        @keydown="emit('handleKey', $event, task)" @dragstart.prevent @contextmenu.prevent>
        <Icon name="lucide:grip-vertical" class="text-xl" aria-hidden="true" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.task-card { transition: border-color 160ms ease, opacity 160ms ease; }
.task-card:hover { border-color: #bac9d6; }
.task-card-moving { opacity: .3; border-style: dashed; border-color: #07846b; }
.task-card-preview { border-color: #07846b; box-shadow: 0 4px 12px rgb(16 33 77 / 10%); }
.drag-handle {
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid #e0e6ed;
  border-radius: 12px;
  color: #627084;
  background: #f6f8fb;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  transition: color 160ms ease, background-color 160ms ease, border-color 160ms ease;
}
button.drag-handle { cursor: grab; }
.drag-handle:hover, .drag-handle-active { background: #ecfcf7; color: #076a58; border-color: #17b995; }
button.drag-handle-active { cursor: grabbing; }
.drag-handle[aria-disabled='true'] { cursor: wait; opacity: .5; }
</style>
