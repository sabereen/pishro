<script setup lang="ts">
import type { Task } from '#shared/models'
import { pointValues, statusLabels } from '#shared/scrum'

definePageMeta({ layout: 'project', middleware: 'auth', key: (route) => route.path })
const { data: project } = await useProject()
const id = String(useRoute().params.projectId)
const { user } = useAuth()
const planned = (task: Task) =>
  project.value?.sprints.some(
    (sprint) => sprint.id === task.sprintId && sprint.status === 'planned',
  ) ?? false
const ownAssignment = (task: Task) =>
  !planned(task) || !task.assigneeId || task.assigneeId === user.value?.id
const bulkSelfOnly = computed(
  () =>
    project.value?.tasks.some((task) => selected.value.includes(task.id) && planned(task)) ?? false,
)
const { busy, run } = useAction()
const title = ref('')
const quickInput = ref<HTMLInputElement>()
const search = ref('')
const sprintFilter = ref('all')
const selected = ref<string[]>([])
const drawer = ref(false)
const selectedTask = ref<string | null>(null)
const dragged = ref('')
const visible = computed(
  () =>
    project.value?.tasks.filter(
      (task) =>
        task.title.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()) &&
        (sprintFilter.value === 'all' ||
          (sprintFilter.value === 'none' ? !task.sprintId : task.sprintId === sprintFilter.value)),
    ) ?? [],
)
const allSelected = computed(
  () => visible.value.length > 0 && visible.value.every((task) => selected.value.includes(task.id)),
)

async function create() {
  if (!title.value.trim()) return
  if (
    await run(async () => {
      await $fetch(`/api/projects/${id}/tasks`, { method: 'POST', body: { title: title.value } })
      title.value = ''
      await refreshProject(id)
    })
  ) {
    await nextTick()
    quickInput.value?.focus()
  }
}
async function patch(task: Task, body: Record<string, unknown>) {
  await run(async () => {
    await $fetch(`/api/projects/${id}/tasks/${task.id}`, { method: 'PATCH', body })
    await refreshProject(id)
  })
}
async function bulk(body: Record<string, unknown>) {
  if (!selected.value.length) return
  await run(async () => {
    await $fetch(`/api/projects/${id}/tasks`, {
      method: 'PATCH',
      body: { ids: selected.value, patch: body },
    })
    await refreshProject(id)
    selected.value = []
  }, 'کارهای انتخاب‌شده به‌روز شدند')
}
async function move(taskId: string, target: string | number) {
  const tasks = [...(project.value?.tasks ?? [])]
  const index = tasks.findIndex((task) => task.id === taskId)
  const destination =
    typeof target === 'number' ? index + target : tasks.findIndex((task) => task.id === target)
  if (index < 0 || destination < 0 || destination >= tasks.length || index === destination) return
  const [task] = tasks.splice(index, 1)
  if (!task) return
  tasks.splice(destination, 0, task)
  await run(async () => {
    await $fetch(`/api/projects/${id}/tasks`, {
      method: 'PATCH',
      body: { order: tasks.map((item) => item.id) },
    })
    await refreshProject(id)
  })
}
function toggleAll() {
  selected.value = allSelected.value ? [] : visible.value.map((task) => task.id)
}
function openTask(taskId: string) {
  selectedTask.value = taskId
  drawer.value = true
}
function startDrag(event: DragEvent, taskId: string) {
  dragged.value = taskId
  event.dataTransfer?.setData('text/plain', taskId)
}
</script>

<template>
  <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold">بک‌لاگ</h1>
      <p class="mt-2 text-sm text-muted">ایده‌ها را به کارهای روشن و قابل انجام تبدیل کنید.</p>
    </div>
    <span class="rounded-lg bg-white px-3 py-2 text-xs text-muted"
      >{{ visible.length.toLocaleString('fa-IR') }} کار</span
    >
  </div>
  <form class="panel mb-5 flex gap-3 p-3" @submit.prevent="create">
    <input
      ref="quickInput"
      v-model="title"
      class="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
      placeholder="+ عنوان کار را بنویسید و Enter بزنید…"
      required
      maxlength="240"
      :disabled="busy"
      aria-label="عنوان کار جدید"
    /><button class="button-primary px-4 py-2 text-sm" :disabled="busy || !title.trim()">
      افزودن
    </button>
  </form>
  <div class="mb-4 flex flex-wrap gap-3">
    <input
      v-model="search"
      class="field max-w-xs text-sm"
      type="search"
      placeholder="پیدا کردن کار…"
      aria-label="جست‌وجو در بک‌لاگ"
    /><select v-model="sprintFilter" class="field w-auto text-sm" aria-label="فیلتر اسپرینت">
      <option value="all">همه اسپرینت‌ها</option>
      <option value="none">بدون اسپرینت</option>
      <option v-for="sprint in project?.sprints" :key="sprint.id" :value="sprint.id">
        {{ sprint.name }}
      </option>
    </select>
  </div>
  <Transition name="ui-reveal">
  <div
    v-if="selected.length"
    class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-100 bg-brand-50 p-3"
  >
    <span class="text-sm font-bold text-brand-700"
      >{{ selected.length.toLocaleString('fa-IR') }} انتخاب</span
    >
    <select
      class="field w-auto py-2 text-xs"
      aria-label="تعیین پوینت گروهی"
      :disabled="busy"
      value=""
      @change="
        bulk({
          point:
            ($event.target as HTMLSelectElement).value === 'none'
              ? null
              : Number(($event.target as HTMLSelectElement).value),
        })
      "
    >
      <option value="" disabled>تغییر پوینت</option>
      <option value="none">بدون تخمین</option>
      <option v-for="point in pointValues" :key="point" :value="point">{{ point }}</option>
    </select>
    <select
      class="field w-auto py-2 text-xs"
      aria-label="تعیین مسئول گروهی"
      :disabled="busy"
      value=""
      @change="
        bulk({
          assigneeId:
            ($event.target as HTMLSelectElement).value === 'none'
              ? null
              : ($event.target as HTMLSelectElement).value,
        })
      "
    >
      <option value="" disabled>تغییر مسئول</option>
      <option value="none">بدون مسئول</option>
      <option
        v-for="member in project?.members.filter(
          (member) => !bulkSelfOnly || member.id === user?.id,
        )"
        :key="member.id"
        :value="member.id"
      >
        {{ member.name }}
      </option>
    </select>
    <select
      class="field w-auto py-2 text-xs"
      aria-label="تعیین اسپرینت گروهی"
      :disabled="busy"
      value="choose"
      @change="bulk({ sprintId: ($event.target as HTMLSelectElement).value || null })"
    >
      <option value="choose" disabled>انتقال به اسپرینت</option>
      <option value="">بدون اسپرینت</option>
      <option
        v-for="sprint in project?.sprints.filter((item) => item.status !== 'completed')"
        :key="sprint.id"
        :value="sprint.id"
      >
        {{ sprint.name }}
      </option>
    </select>
    <button class="h-11 px-3 text-xs text-muted" @click="selected = []">لغو انتخاب</button>
    <NuxtLink
      :to="{ path: `/projects/${id}/poker`, query: { tasks: selected.join(',') } }"
      class="button-secondary py-2 text-xs"
      >برآورد با تیم<Icon name="lucide:arrow-left" aria-hidden="true"
    /></NuxtLink>
  </div>
  </Transition>
  <div v-if="visible.length" class="panel overflow-x-auto">
    <table class="w-full min-w-190 text-right text-sm">
      <thead class="border-b border-line bg-canvas text-xs text-muted">
        <tr>
          <th class="w-12 p-3">
            <input
              type="checkbox"
              :checked="allSelected"
              class="h-4 w-4 accent-brand-600"
              aria-label="انتخاب همه کارهای نمایش‌داده‌شده"
              @change="toggleAll"
            />
          </th>
          <th class="py-4">عنوان کار</th>
          <th class="p-3">پوینت</th>
          <th class="p-3">مسئول</th>
          <th class="p-3">اسپرینت</th>
          <th class="p-3">ترتیب</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="task in visible"
          :key="task.id"
          class="border-b border-line last:border-b-0 hover:bg-canvas/60"
          @dragover.prevent
          @drop.prevent="move(dragged, task.id)"
        >
          <td class="p-3">
            <input
              v-model="selected"
              :value="task.id"
              type="checkbox"
              class="h-4 w-4 accent-brand-600"
              :aria-label="`انتخاب ${task.title}`"
            />
          </td>
          <td class="min-w-60 py-3">
            <div class="flex items-start gap-2">
              <button
                class="mt-0.5 h-10 w-7 shrink-0 rounded-lg text-muted hover:bg-white"
                aria-label="باز کردن جزئیات"
                @click="openTask(task.id)"
              >
                <Icon name="lucide:panel-left-open" aria-hidden="true" />
              </button>
              <div class="min-w-0 flex-1">
                <input
                  :value="task.title"
                  class="w-full rounded-lg bg-transparent px-2 py-2 font-medium outline-none focus:bg-white"
                  :aria-label="`ویرایش عنوان ${task.title}`"
                  maxlength="240"
                  :disabled="busy"
                  @change="patch(task, { title: ($event.target as HTMLInputElement).value })"
                />
                <p class="px-2 text-xs text-muted">
                  {{ statusLabels[task.status]
                  }}<span v-if="task.priority === 'high'" class="mr-3 text-amber-700"
                    >اولویت بالا</span
                  >
                </p>
              </div>
            </div>
          </td>
          <td class="p-3">
            <select
              :value="task.point === null ? '' : task.point"
              class="h-11 min-w-16 rounded-lg border border-line bg-white px-2"
              :disabled="busy"
              :aria-label="`پوینت ${task.title}`"
              @change="
                patch(task, {
                  point:
                    ($event.target as HTMLSelectElement).value === ''
                      ? null
                      : Number(($event.target as HTMLSelectElement).value),
                })
              "
            >
              <option value="">—</option>
              <option
                v-for="point in [
                  ...new Set([...pointValues, ...(task.point === null ? [] : [task.point])]),
                ].sort((a, b) => a - b)"
                :key="point"
                :value="point"
              >
                {{ point }}
              </option>
            </select>
          </td>
          <td class="p-3">
            <select
              :value="task.assigneeId ?? ''"
              class="h-11 max-w-36 rounded-lg border border-line bg-white px-2 text-xs"
              :disabled="busy || !ownAssignment(task)"
              :aria-label="`مسئول ${task.title}`"
              @change="
                patch(task, { assigneeId: ($event.target as HTMLSelectElement).value || null })
              "
            >
              <option value="">بدون مسئول</option>
              <option
                v-for="member in project?.members.filter(
                  (member) =>
                    !planned(task) || member.id === user?.id || member.id === task.assigneeId,
                )"
                :key="member.id"
                :value="member.id"
              >
                {{ member.name }}
              </option>
            </select>
          </td>
          <td class="p-3">
            <select
              :value="task.sprintId ?? ''"
              class="h-11 max-w-40 rounded-lg border border-line bg-white px-2 text-xs"
              :disabled="busy || !ownAssignment(task)"
              :aria-label="`اسپرینت ${task.title}`"
              @change="
                patch(task, { sprintId: ($event.target as HTMLSelectElement).value || null })
              "
            >
              <option value="">بدون اسپرینت</option>
              <option
                v-for="sprint in project?.sprints.filter(
                  (item) => item.status !== 'completed' || item.id === task.sprintId,
                )"
                :key="sprint.id"
                :value="sprint.id"
              >
                {{ sprint.name }}
              </option>
            </select>
          </td>
          <td class="p-2">
            <div class="flex">
              <button
                class="h-11 w-8 text-muted"
                aria-label="یک ردیف بالاتر"
                :disabled="busy"
                @click="move(task.id, -1)"
              >
                <Icon name="lucide:arrow-up" aria-hidden="true" /></button
              ><button
                class="h-11 w-8 text-muted"
                aria-label="یک ردیف پایین‌تر"
                :disabled="busy"
                @click="move(task.id, 1)"
              >
                <Icon name="lucide:arrow-down" aria-hidden="true" /></button
              ><button
                class="h-11 w-6 cursor-grab text-muted"
                draggable="true"
                aria-label="کشیدن برای مرتب‌سازی"
                @dragstart="startDrag($event, task.id)"
              >
                <Icon name="lucide:grip-vertical" aria-hidden="true" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <EmptyState
    v-else
    :title="project?.tasks.length ? 'کاری با این فیلتر پیدا نشد' : 'اولین کار تیم را بنویسید'"
    description="از ورودی بالای صفحه برای افزودن سریع کار استفاده کنید."
    icon="lucide:list-plus"
  />
  <TaskDrawer v-if="project" v-model="drawer" :project="project" :task-id="selectedTask" />
</template>
