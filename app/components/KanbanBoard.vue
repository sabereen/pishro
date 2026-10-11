<script setup lang="ts">
import type { ProjectOverview } from '#shared/models'
import type { TaskStatus } from '#shared/scrum'
import { statusLabels, taskStatuses } from '#shared/scrum'

const props = defineProps<{ project: ProjectOverview; sprintId: string }>()
const emit = defineEmits<{ open: [id: string] }>()
const { busy, run } = useAction()
const colors = { todo: 'bg-slate-400', in_progress: 'bg-blue-500', review: 'bg-amber-500', done: 'bg-brand-500' }
const items = computed(() => props.project.tasks.filter((task) => task.sprintId === props.sprintId))
async function change(id: string, status: TaskStatus) {
  if (!items.value.some((task) => task.id === id)) return
  await run(async () => { await $fetch(`/api/projects/${props.project.project.id}/tasks/${id}`, { method: 'PATCH', body: { status } }); await refreshProject(props.project.project.id) })
}
function drop(event: DragEvent, status: TaskStatus) { const id = event.dataTransfer?.getData('text/plain'); if (id) void change(id, status) }
</script>

<template>
  <div class="grid grid-cols-[repeat(4,minmax(245px,1fr))] gap-4 overflow-x-auto pb-4" aria-label="تابلوی اسپرینت">
    <section v-for="status in taskStatuses" :key="status" class="min-h-80 rounded-[18px] border border-line bg-[#eef2f6] p-3" @dragover.prevent @drop.prevent="drop($event, status)">
      <h2 class="mb-4 flex items-center gap-2 px-1 py-2 text-sm font-bold"><span class="h-2 w-2 rounded-full" :class="colors[status]" />{{ statusLabels[status] }}<span class="mr-auto rounded-md bg-white px-2 py-1 text-xs text-muted">{{ items.filter((task) => task.status === status).length.toLocaleString('fa-IR') }}</span></h2>
      <div class="space-y-3"><article v-for="task in items.filter((item) => item.status === status)" :key="task.id" class="rounded-[14px] border border-line bg-white p-4" draggable="true" @dragstart="$event.dataTransfer?.setData('text/plain', task.id)">
        <button class="w-full break-words text-right text-sm font-bold leading-7 hover:text-brand-700" @click="emit('open', task.id)">{{ task.title }}</button>
        <div class="mt-4 flex items-center justify-between gap-2"><span class="min-w-0 truncate text-xs text-muted">{{ project.members.find((member) => member.id === task.assigneeId)?.name ?? 'بدون مسئول' }}</span><PointBadge :point="task.point" /></div>
        <a v-if="task.pullRequests[0]" :href="task.pullRequests[0].url" target="_blank" rel="noopener noreferrer" class="mt-3 flex items-center gap-1.5 rounded-lg py-1 text-xs text-muted"><Icon name="lucide:git-pull-request" aria-hidden="true" />PR #{{ task.pullRequests[0].number }} · {{ { open: 'باز', draft: 'پیش‌نویس', merged: 'ادغام شده', closed: 'بسته' }[task.pullRequests[0].status] }}</a>
        <div class="mt-3 flex items-center gap-2 border-t border-line pt-3"><span v-if="task.priority === 'high'" class="text-xs text-amber-700">اولویت بالا</span><select :value="task.status" class="mr-auto h-11 max-w-full rounded-lg border border-line bg-white px-2 text-xs text-muted" :disabled="busy" :aria-label="`تغییر وضعیت ${task.title}`" @change="change(task.id, ($event.target as HTMLSelectElement).value as TaskStatus)"><option v-for="option in taskStatuses" :key="option" :value="option">{{ statusLabels[option] }}</option></select></div>
      </article><p v-if="!items.some((task) => task.status === status)" class="rounded-xl border border-dashed border-line px-3 py-10 text-center text-xs leading-7 text-muted">{{ status === 'done' ? 'جای اولین کار انجام‌شده اینجاست' : 'کارها را اینجا رها کنید' }}</p></div>
    </section>
  </div>
</template>
