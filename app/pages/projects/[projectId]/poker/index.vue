<script setup lang="ts">
import { pokerLabels } from '#shared/scrum'
import { persianDate } from '#shared/calendar'

definePageMeta({ layout: 'project', middleware: 'auth', key: (route) => route.path })
const { data: project } = await useProject()
const route = useRoute()
const id = String(route.params.projectId)
const { user } = useAuth()
const { data: sessions, error: loadError, refresh } = await useFetch(`/api/projects/${id}/poker`)
const createOpen = ref(Boolean(route.query.tasks))
const name = ref('')
const mode = ref<'tasks' | 'free'>('tasks')
const sprintId = ref('')
const search = ref('')
const taskIds = ref(
  typeof route.query.tasks === 'string'
    ? route.query.tasks
        .split(',')
        .filter((id) => project.value?.tasks.some((task) => task.id === id))
    : [],
)
const participantIds = ref(project.value?.members.slice(0, 50).map((member) => member.id) ?? [])
const candidates = computed(
  () =>
    project.value?.tasks.filter(
      (task) =>
        (!sprintId.value || task.sprintId === sprintId.value) &&
        task.title.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()),
    ) ?? [],
)
const selectedCandidates = computed(
  () => candidates.value.filter((task) => taskIds.value.includes(task.id)).length,
)
const allCandidatesSelected = computed(
  () => candidates.value.length > 0 && selectedCandidates.value === candidates.value.length,
)
const outsideSelection = computed(() => taskIds.value.length - selectedCandidates.value)
function toggleCandidates() {
  const visibleIds = new Set(candidates.value.map((task) => task.id))
  taskIds.value = allCandidatesSelected.value
    ? taskIds.value.filter((id) => !visibleIds.has(id))
    : [...new Set([...taskIds.value, ...visibleIds])]
}
const { busy, run } = useAction()
async function create() {
  await run(async () => {
    const result = await $fetch(`/api/projects/${id}/poker`, {
      method: 'POST',
      body: {
        name: name.value,
        mode: mode.value,
        sprintId: mode.value === 'free' ? null : sprintId.value || null,
        taskIds: mode.value === 'free' ? [] : taskIds.value,
        participantIds: participantIds.value,
      },
    })
    await refresh()
    createOpen.value = false
    await navigateTo(`/projects/${id}/poker/${result.id}`)
  })
}
</script>

<template>
  <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold">پلنینگ پوکر</h1>
      <p class="mt-2 text-sm text-muted">
        هر دیدگاه، یک تکه از تصویر؛ با هم به یک تخمین روشن برسید.
      </p>
    </div>
    <button class="button-primary" @click="createOpen = true">
      <Icon name="lucide:plus" aria-hidden="true" /> جلسه جدید
    </button>
  </div>
  <p v-if="loadError" role="alert" class="panel p-5 text-red-700">{{ requestError(loadError) }}</p>
  <ul v-else-if="sessions?.length" class="panel divide-y divide-line" aria-label="جلسات پوکر">
    <li
      v-for="session in sessions"
      :key="session.id"
      class="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-3 p-4 sm:gap-x-4 sm:p-5 md:grid-cols-[auto_minmax(0,1fr)_auto]"
    >
      <span
        class="h-10 w-10 flex items-center justify-center rounded-xl bg-brand-50 text-lg text-brand-700 sm:h-12 sm:w-12 sm:text-xl"
        ><Icon name="lucide:panels-top-left" aria-hidden="true"
      /></span>
      <div class="min-w-0">
        <h2 :id="`poker-session-${session.id}`" class="break-words font-bold leading-7">
          <bdi>{{ session.name }}</bdi>
        </h2>
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
          <span class="rounded-lg bg-canvas px-2.5 py-1 leading-5">
            {{ session.mode === 'free' ? 'جلسه آزاد · ' : '' }}{{ pokerLabels[session.status] }}
          </span>
          <span>{{ persianDate(session.createdAt) }}</span>
        </div>
      </div>
      <div class="col-span-2 flex justify-end md:col-span-1 md:self-center">
        <NuxtLink
          v-if="session.invited"
          :to="`/projects/${id}/poker/${session.id}`"
          :aria-describedby="`poker-session-${session.id}`"
          class="button-secondary text-sm"
        >
          {{
            session.status === 'finalized'
              ? session.mode === 'free'
                ? 'دیدن جلسه'
                : 'دیدن تخمین‌ها'
              : 'ورود به جلسه'
          }}<Icon name="lucide:arrow-left" aria-hidden="true" />
        </NuxtLink>
        <span v-else class="text-xs leading-6 text-muted">ویژه شرکت‌کنندگان دعوت‌شده</span>
      </div>
    </li>
  </ul>
  <EmptyState
    v-else
    title="تیم را دور یک میز جمع کنید"
    description="کارهای بک‌لاگ را برآورد کنید یا یک جلسه آزاد برای رأی‌گیری سریع بسازید."
    icon="lucide:panels-top-left"
    ><button class="button-primary" @click="createOpen = true">شروع اولین جلسه</button></EmptyState
  >
  <UiDialog v-model="createOpen" title="یک جلسه برای برآورد مشترک"
    ><form class="space-y-5" @submit.prevent="create">
      <label class="block text-sm font-bold"
        >نام جلسه<input
          v-model="name"
          class="field mt-2"
          required
          maxlength="120"
          placeholder="مثلاً برنامه‌ریزی اسپرینت ۲۴"
      /></label>
      <fieldset>
        <legend class="mb-3 text-sm font-bold">نوع جلسه</legend>
        <div class="grid gap-3 sm:grid-cols-2">
          <label
            v-for="option in [
              {
                value: 'tasks',
                title: 'برآورد کارها',
                description: 'انتخاب تسک و ثبت تخمین نهایی',
              },
              {
                value: 'free',
                title: 'جلسه آزاد',
                description: 'بدون تسک؛ رأی، نتیجه و شروع دوباره',
              },
            ]"
            :key="option.value"
            class="flex cursor-pointer items-start gap-3 rounded-xl border p-4"
            :class="mode === option.value ? 'border-brand-600 bg-brand-50' : 'border-line'"
            ><input
              v-model="mode"
              type="radio"
              name="session-mode"
              :value="option.value"
              class="mt-1 accent-brand-600"
            /><span
              ><span class="block text-sm font-bold">{{ option.title }}</span
              ><span class="mt-2 block text-xs leading-6 text-muted">{{
                option.description
              }}</span></span
            ></label
          >
        </div>
      </fieldset>
      <p v-if="mode === 'free'" class="rounded-xl bg-canvas p-4 text-xs leading-7 text-muted">
        فقط رأی‌های دور جاری نمایش داده می‌شوند. با ریست یا پایان جلسه پاک می‌شوند و هیچ پوینتی برای
        کارها ثبت نمی‌شود.
      </p>
      <template v-if="mode === 'tasks'"
        ><label class="block text-sm"
          >اسپرینت<select v-model="sprintId" class="field mt-2">
            <option value="">بدون اسپرینت / همه کارها</option>
            <option
              v-for="sprint in project?.sprints.filter((item) => item.status !== 'completed')"
              :key="sprint.id"
              :value="sprint.id"
            >
              {{ sprint.name }}
            </option>
          </select></label
        >
        <fieldset>
          <legend class="mb-3 text-sm font-bold">
            کارها · {{ taskIds.length.toLocaleString('fa-IR') }} انتخاب
          </legend>
          <input
            v-model="search"
            class="field mb-3 text-sm"
            type="search"
            placeholder="جست‌وجو در کارها…"
            aria-label="جست‌وجو برای انتخاب کار"
          />
          <div
            class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas p-3"
          >
            <label class="flex min-h-11 items-center gap-3 text-sm font-bold"
              ><input
                type="checkbox"
                class="h-4 w-4 accent-brand-600"
                :checked="allCandidatesSelected"
                :indeterminate="selectedCandidates > 0 && !allCandidatesSelected"
                :disabled="!candidates.length"
                @change="toggleCandidates"
              /><span
                >{{
                  sprintId && !search.trim() ? 'انتخاب همه کارهای اسپرینت' : 'انتخاب همه نتایج'
                }}
                · {{ candidates.length.toLocaleString('fa-IR') }}</span
              ></label
            ><button
              v-if="taskIds.length"
              type="button"
              class="min-h-11 px-2 text-xs text-muted"
              @click="taskIds = []"
            >
              پاک کردن همه انتخاب‌ها
            </button>
          </div>
          <p v-if="outsideSelection" class="mb-3 text-xs leading-7 text-muted" role="status">
            {{ outsideSelection.toLocaleString('fa-IR') }} کار انتخاب‌شده خارج از فیلتر فعلی است؛
            انتخاب‌ها حفظ می‌شوند.
          </p>
          <p v-if="taskIds.length > 100" role="alert" class="mb-3 text-xs leading-7 text-amber-800">
            هر جلسه حداکثر ۱۰۰ کار دارد؛ تعداد انتخاب‌ها را کم کنید.
          </p>
          <div class="max-h-55 overflow-y-auto space-y-2">
            <label
              v-for="task in candidates"
              :key="task.id"
              class="flex items-center gap-3 rounded-lg border border-line p-3 text-sm"
              ><input
                v-model="taskIds"
                :value="task.id"
                type="checkbox"
                class="h-4 w-4 shrink-0 accent-brand-600" /><span
                class="min-w-0 flex-1 break-words"
                >{{ task.title }}</span
              ><PointBadge :point="task.point"
            /></label>
            <p v-if="!candidates.length" class="p-4 text-xs leading-7 text-muted">
              کاری برای انتخاب نیست؛ ابتدا چند کار به بک‌لاگ اضافه کنید.
            </p>
          </div>
        </fieldset></template
      >
      <fieldset>
        <legend class="mb-3 text-sm font-bold">شرکت‌کنندگان</legend>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="member in project?.members"
            :key="member.id"
            class="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm"
            ><input
              v-model="participantIds"
              :value="member.id"
              type="checkbox"
              :disabled="member.id === user?.id"
              class="accent-brand-600"
            /><UserAvatar :name="member.name" :src="member.avatarUrl" :size="28" />{{
              member.name
            }}</label
          >
        </div>
      </fieldset>
      <p class="text-xs leading-7 text-muted">
        شما تسهیل‌گر هستید. جلسه ابتدا به‌صورت پیش‌نویس ساخته می‌شود؛ بعد از ورود تیم، رأی‌گیری را
        شروع کنید.
      </p>
      <button
        class="button-primary w-full"
        :disabled="busy || (mode === 'tasks' && (!taskIds.length || taskIds.length > 100))"
      >
        ساخت جلسه
      </button>
    </form></UiDialog
  >
</template>
