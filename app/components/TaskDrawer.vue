<script setup lang="ts">
import type { ProjectOverview } from '#shared/models'
import type { TaskStatus } from '#shared/scrum'
import { pointValues, statusLabels, taskStatuses } from '#shared/scrum'
import { persianDate } from '#shared/calendar'

const props = defineProps<{ project: ProjectOverview; taskId: string | null }>()
const open = defineModel<boolean>({ default: false })
const { user } = useAuth()
const selfOnly = computed(() =>
  props.project.sprints.some(
    (sprint) =>
      sprint.status === 'planned' &&
      (sprint.id === form.sprintId || sprint.id === task.value?.sprintId),
  ),
)
const canAssign = computed(
  () => !selfOnly.value || !task.value?.assigneeId || task.value.assigneeId === user.value?.id,
)
const task = computed(() => props.project.tasks.find((item) => item.id === props.taskId))
const form = reactive({
  title: '',
  description: '',
  status: 'todo' as TaskStatus,
  point: null as number | null,
  assigneeId: '',
  sprintId: '',
  priority: 'normal',
})
const prUrl = ref('')
const revision = ref(0)
const { busy, run } = useAction()
watch(
  () => [open.value, props.taskId],
  () => {
    if (!open.value) return
    const item = task.value
    revision.value = item?.revision ?? 0
    Object.assign(form, {
      title: item?.title ?? '',
      description: item?.description ?? '',
      status: item?.status ?? 'todo',
      point: item?.point ?? null,
      assigneeId: item?.assigneeId ?? '',
      sprintId: item?.sprintId ?? '',
      priority: item?.priority ?? 'normal',
    })
    prUrl.value = ''
  },
  { immediate: true },
)
async function save() {
  await run(
    async () => {
      const body = {
        ...form,
        revision: revision.value,
        assigneeId: form.assigneeId || null,
        sprintId: form.sprintId || null,
      }
      try {
        if (props.taskId)
          await $fetch(`/api/projects/${props.project.project.id}/tasks/${props.taskId}`, {
            method: 'PATCH',
            body,
          })
        else
          await $fetch(`/api/projects/${props.project.project.id}/tasks`, { method: 'POST', body })
      } catch (cause) {
        await refreshProject(props.project.project.id).catch(() => {})
        throw cause
      }
      await refreshProject(props.project.project.id)
      open.value = false
    },
    props.taskId ? 'کار به‌روز شد' : 'کار جدید اضافه شد',
  )
}
async function attachPr() {
  if (!props.taskId) return
  await run(async () => {
    await $fetch(`/api/projects/${props.project.project.id}/tasks/${props.taskId}/pull-requests`, {
      method: 'POST',
      body: { url: prUrl.value },
    })
    await refreshProject(props.project.project.id)
    prUrl.value = ''
  }, 'Pull Request متصل شد')
}
async function removePr(id: string) {
  await run(async () => {
    await $fetch(`/api/projects/${props.project.project.id}/tasks/${props.taskId}/pull-requests`, {
      method: 'DELETE',
      body: { id },
    })
    await refreshProject(props.project.project.id)
  }, 'اتصال PR برداشته شد')
}
</script>

<template>
  <UiDialog v-model="open" :title="taskId ? 'جزئیات کار' : 'یک کار تازه'" drawer>
    <form class="space-y-5" @submit.prevent="save">
      <label class="block text-sm font-bold"
        >عنوان<input v-model="form.title" class="field mt-2" required maxlength="240" autofocus
      /></label>
      <label class="block text-sm"
        >توضیحات<textarea
          v-model="form.description"
          class="field mt-2 min-h-30 resize-y leading-8"
          maxlength="10000"
          placeholder="تیم برای انجام این کار چه چیزی باید بداند؟"
        />
      </label>
      <div class="grid grid-cols-2 gap-4">
        <label class="text-sm"
          >وضعیت<select v-model="form.status" class="field mt-2">
            <option v-for="status in taskStatuses" :key="status" :value="status">
              {{ statusLabels[status] }}
            </option>
          </select></label
        >
        <label class="text-sm"
          >مسئول<select v-model="form.assigneeId" class="field mt-2" :disabled="!canAssign">
            <option value="">بدون مسئول</option>
            <option
              v-for="member in project.members.filter(
                (member) => !selfOnly || member.id === user?.id || member.id === task?.assigneeId,
              )"
              :key="member.id"
              :value="member.id"
            >
              {{ member.name }}
            </option>
          </select></label
        >
        <label class="text-sm"
          >پوینت<select v-model="form.point" class="field mt-2">
            <option :value="null">بدون تخمین</option>
            <option
              v-for="point in [
                ...new Set([...pointValues, ...(form.point === null ? [] : [form.point])]),
              ].sort((a, b) => a - b)"
              :key="point"
              :value="point"
            >
              {{ point.toLocaleString('fa-IR') }}
            </option>
          </select></label
        >
        <label class="text-sm"
          >اولویت<select v-model="form.priority" class="field mt-2">
            <option value="low">کم</option>
            <option value="normal">عادی</option>
            <option value="high">زیاد</option>
          </select></label
        >
      </div>
      <label class="block text-sm"
        >اسپرینت<select v-model="form.sprintId" class="field mt-2" :disabled="!canAssign">
          <option value="">بک‌لاگ / بدون اسپرینت</option>
          <option
            v-for="sprint in project.sprints.filter(
              (item) => item.status !== 'completed' || item.id === form.sprintId,
            )"
            :key="sprint.id"
            :value="sprint.id"
          >
            {{ sprint.name }}
          </option>
        </select></label
      >
      <button class="button-primary w-full" :disabled="busy">
        {{ busy ? 'در حال ذخیره…' : taskId ? 'ذخیره تغییرات' : 'افزودن کار' }}
      </button>
    </form>
    <section v-if="task" class="mt-8 border-t border-line pt-6">
      <h3 class="mb-4 flex items-center gap-2 font-bold">
        <Icon name="lucide:git-pull-request" aria-hidden="true" /> توسعه
      </h3>
      <div
        v-for="pr in task.pullRequests"
        :key="pr.id"
        class="mb-3 rounded-xl border border-line p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <a
            :href="pr.url"
            target="_blank"
            rel="noopener noreferrer"
            class="min-w-0 text-sm font-bold text-brand-700"
            dir="ltr"
            >{{ pr.repository }} #{{ pr.number }}</a
          ><button
            class="h-11 w-8 shrink-0 text-muted"
            aria-label="حذف اتصال PR"
            :disabled="busy"
            @click="removePr(pr.id)"
          >
            <Icon name="lucide:x" aria-hidden="true" />
          </button>
        </div>
        <p class="break-words text-sm leading-7">{{ pr.title }}</p>
        <span
          class="mt-2 inline-block rounded-lg bg-canvas px-2 py-1 text-xs"
          :class="
            pr.status === 'merged'
              ? 'text-violet-700'
              : pr.status === 'open'
                ? 'text-brand-700'
                : 'text-muted'
          "
          >{{
            { open: 'باز', merged: 'ادغام شده', closed: 'بسته', draft: 'پیش‌نویس' }[pr.status]
          }}</span
        >
      </div>
      <form class="flex items-start gap-2" @submit.prevent="attachPr">
        <label class="min-w-0 flex-1"
          ><span class="sr-only">لینک Pull Request</span
          ><input
            v-model="prUrl"
            class="field text-left text-sm"
            dir="ltr"
            type="url"
            placeholder="https://github.com/…/pull/…"
            required /></label
        ><button class="button-secondary" :disabled="busy">اتصال</button>
      </form>
      <p class="mt-3 text-xs leading-6 text-muted">
        اطلاعات هنگام اتصال دریافت می‌شود. وضعیت Task به‌صورت خودکار تغییر نمی‌کند.
      </p>
      <p class="mt-6 text-xs text-muted">آخرین تغییر: {{ persianDate(task.updatedAt) }}</p>
    </section>
  </UiDialog>
</template>
