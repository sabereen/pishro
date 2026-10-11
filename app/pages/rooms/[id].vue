<script setup lang="ts">
import { voteLabel, voteValues } from '../../../shared/poker'

definePageMeta({ key: (route) => route.path })

const route = useRoute()
const id = String(route.params.id)
const { data, error: loadError } = await useFetch(`/api/rooms/${id}`)
const { room, busy, error, connection, join, vote, round, addTask } = usePokerRoom(id, data.value?.joined ? data.value.room : null)
const participantName = ref('')
const newTask = ref('')
const copied = ref(false)
const copyError = ref('')
const shareLink = ref('')
let copyTimer: ReturnType<typeof setTimeout> | undefined

const roomName = computed(() => room.value?.name ?? (data.value && !data.value.joined ? data.value.name : 'جلسه'))
const voteCount = computed(() => room.value?.participants.filter((person) => person.hasVoted).length ?? 0)
const onlineCount = computed(() => room.value?.participants.filter((person) => person.online).length ?? 0)
const onlineVotes = computed(() => room.value?.participants.filter((person) => person.online && person.hasVoted).length ?? 0)

useSeoMeta({ title: () => `${roomName.value} | پیشرو`, robots: 'noindex, nofollow' })
onMounted(() => { shareLink.value = `${window.location.origin}/rooms/${id}` })
onScopeDispose(() => { clearTimeout(copyTimer) })

async function copyInvite() {
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(shareLink.value)
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 2500)
  } catch {
    copyError.value = 'کپی خودکار ممکن نشد؛ لینک زیر را انتخاب و کپی کنید.'
  }
}

async function submitTask(title: string) {
  if (await addTask(title)) newTask.value = ''
}
</script>

<template>
  <section v-if="loadError && !room" class="panel mx-auto max-w-lg p-8 text-center">
    <Icon name="lucide:unplug" class="text-4xl text-muted" aria-hidden="true" />
    <h1 class="mt-4 text-xl font-bold">جلسه در دسترس نیست</h1>
    <p class="mt-3 text-sm leading-8 text-muted">{{ requestError(loadError) }}</p>
    <NuxtLink to="/" class="button-primary mt-6">بازگشت به خانه</NuxtLink>
  </section>

  <section v-else-if="!room" class="panel mx-auto max-w-lg p-6 sm:p-8">
    <span class="mb-5 h-14 w-14 flex items-center justify-center rounded-2xl bg-brand-50 text-2xl text-brand-700">
      <Icon name="lucide:hand" aria-hidden="true" />
    </span>
    <p class="text-sm text-muted">به جلسه دعوت شده‌اید</p>
    <h1 class="mt-3 break-words text-2xl font-bold leading-10">{{ roomName }}</h1>
    <p class="mt-3 text-sm leading-8 text-muted">نام خود را وارد کنید و کنار تیم بنشینید. رأی شما تا زمان نمایش کارت‌ها برای دیگران پنهان می‌ماند.</p>
    <form class="mt-6 space-y-4" @submit.prevent="join(participantName)">
      <label for="participant-name" class="block text-sm font-bold">نام شما</label>
      <input id="participant-name" v-model="participantName" class="field" required maxlength="60" autocomplete="nickname" :disabled="busy" placeholder="نامی که تیم می‌شناسد" />
      <button type="submit" class="button-primary w-full" :disabled="busy">
        <Icon name="lucide:log-in" aria-hidden="true" /> {{ busy ? 'در حال پیوستن…' : 'پیوستن به جلسه' }}
      </button>
    </form>
    <p v-if="error" role="alert" class="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-700">{{ error }}</p>
    <p class="mt-5 text-xs leading-6 text-muted">دسترسی شما در همین مرورگر حفظ می‌شود. لینک جلسه را فقط با اعضای تیم به اشتراک بگذارید.</p>
  </section>

  <div v-else>
    <div class="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div class="min-w-0">
        <NuxtLink to="/" class="inline-flex items-center gap-1 rounded-lg text-xs text-muted hover:text-brand-700">
          <Icon name="lucide:arrow-right" aria-hidden="true" /> خانه
        </NuxtLink>
        <h1 class="mt-3 break-words text-2xl font-bold leading-10 sm:text-3xl">{{ room.name }}</h1>
        <p role="status" class="mt-3 flex items-center gap-2 text-xs text-muted">
          <span class="h-2 w-2 rounded-full" :class="connection === 'connected' ? 'bg-brand-500' : 'bg-amber-500'" />
          {{ connection === 'connected' ? 'همگام با تیم' : connection === 'connecting' ? 'در حال اتصال…' : 'در حال اتصال مجدد؛ تغییرات پس از اتصال همگام می‌شوند' }}
        </p>
      </div>
      <button type="button" class="button-secondary" @click="copyInvite">
        <Icon :name="copied ? 'lucide:check' : 'lucide:link'" aria-hidden="true" />
        {{ copied ? 'لینک کپی شد' : 'دعوت از تیم' }}
      </button>
    </div>

    <div v-if="copyError" role="status" class="mb-5 rounded-xl border border-line bg-white p-4 text-sm">
      <p class="mb-2">{{ copyError }}</p>
      <input :value="shareLink" aria-label="لینک دعوت" readonly dir="ltr" class="field text-left" @focus="($event.target as HTMLInputElement).select()" />
    </div>
    <p v-if="error" role="alert" class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-700">{{ error }}</p>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section class="panel min-w-0 p-5 sm:p-8">
        <template v-if="room.activeTask">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span class="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">کار {{ (room.activeTask.position + 1).toLocaleString('fa-IR') }} از {{ room.tasks.length.toLocaleString('fa-IR') }}</span>
            <span class="flex items-center gap-2 text-xs" :class="room.revealed ? 'text-brand-700' : 'text-muted'">
              <Icon :name="room.revealed ? 'lucide:eye' : 'lucide:eye-off'" aria-hidden="true" />
              {{ room.revealed ? 'کارت‌ها نمایش داده شدند' : 'رأی‌ها پنهان هستند' }}
            </span>
          </div>
          <h2 class="mt-6 break-words text-xl font-bold leading-10 sm:text-2xl">{{ room.activeTask.title }}</h2>
          <p class="mt-3 text-sm leading-8 text-muted">{{ room.revealed ? 'حالا زمان گفت‌وگوست. چه چیزی باعث تفاوت برآوردها شده؟' : 'پیچیدگی، حجم کار و ابهام را در نظر بگیرید؛ کدام کارت برآورد شماست؟' }}</p>

          <div class="my-7 rounded-2xl border border-line bg-canvas p-5">
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="font-bold">{{ voteCount.toLocaleString('fa-IR') }} رأی ثبت شده</span>
              <span class="text-xs text-muted">{{ onlineVotes.toLocaleString('fa-IR') }} از {{ onlineCount.toLocaleString('fa-IR') }} نفر آنلاین</span>
            </div>
            <div class="mt-4 h-2 overflow-hidden rounded-full bg-white" role="progressbar" :aria-valuenow="onlineVotes" :aria-valuemax="Math.max(onlineCount, 1)" aria-valuemin="0" aria-label="تعداد رأی‌های اعضای آنلاین">
              <div class="h-full rounded-full bg-brand-500 transition-[width] duration-200" :style="{ width: `${onlineCount ? onlineVotes / onlineCount * 100 : 0}%` }" />
            </div>
          </div>

          <fieldset :disabled="busy || room.revealed" class="min-w-0">
            <legend class="mb-4 text-sm font-bold">کارت شما <span class="font-normal text-muted">· {{ room.me.vote === null ? 'هنوز انتخاب نکرده‌اید' : voteLabel(room.me.vote) }}</span></legend>
            <div dir="ltr" class="grid grid-cols-5 gap-2 sm:gap-3">
              <button v-for="value in voteValues" :key="value" type="button" :aria-pressed="room.me.vote === value" :aria-label="value === 'coffee' ? 'نیاز به استراحت' : value === '?' ? 'نیاز به توضیح بیشتر' : `برآورد ${value}`" class="h-21 flex items-center justify-center rounded-xl border-2 text-2xl font-bold transition-[transform,background-color,border-color] duration-150 enabled:hover:-translate-y-1 disabled:cursor-default sm:h-24" :class="room.me.vote === value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink enabled:hover:border-brand-500'" @click="vote(value)">
                <Icon v-if="value === 'coffee'" name="lucide:coffee" aria-hidden="true" />
                <template v-else>{{ value }}</template>
              </button>
            </div>
          </fieldset>
          <p class="mt-4 text-xs leading-7 text-muted">{{ room.revealed ? 'انتخاب کارت بسته شده؛ میزبان می‌تواند این دور را تکرار کند.' : 'تا پیش از نمایش کارت‌ها می‌توانید رأی خود را تغییر دهید. ? یعنی توضیح بیشتر و ☕ یعنی یک استراحت کوتاه.' }}</p>

          <PokerResults v-if="room.revealed" :room="room" />

          <div v-if="room.me.isHost" class="mt-7 flex flex-wrap gap-3 border-t border-line pt-6">
            <button v-if="!room.revealed" type="button" class="button-primary flex-1" :disabled="busy || voteCount === 0" @click="round('reveal')">
              <Icon name="lucide:eye" aria-hidden="true" /> نمایش کارت‌ها
            </button>
            <template v-else>
              <button type="button" class="button-primary flex-1" :disabled="busy" @click="round('next')">
                {{ room.activeTask.position === room.tasks.length - 1 ? 'پایان جلسه' : 'کار بعدی' }} <Icon name="lucide:arrow-left" aria-hidden="true" />
              </button>
              <button type="button" class="button-secondary" :disabled="busy" @click="round('reset')">
                <Icon name="lucide:rotate-ccw" aria-hidden="true" /> رأی‌گیری دوباره
              </button>
            </template>
          </div>
          <p v-else class="mt-6 border-t border-line pt-5 text-center text-xs leading-7 text-muted">میزبان زمان نمایش کارت‌ها و رفتن به کار بعدی را مشخص می‌کند.</p>
        </template>

        <div v-else class="py-12 text-center">
          <span class="mx-auto h-20 w-20 flex items-center justify-center rounded-3xl bg-brand-50 text-4xl text-brand-600"><Icon name="lucide:party-popper" aria-hidden="true" /></span>
          <h2 class="mt-6 text-2xl font-bold">یک قدم جلوتر، با هم!</h2>
          <p class="mx-auto mt-4 max-w-sm text-sm leading-8 text-muted">همه {{ room.tasks.length.toLocaleString('fa-IR') }} کار این جلسه برآورد شدند. {{ room.me.isHost ? 'برای ادامه، یک کار جدید به مسیر جلسه اضافه کنید.' : 'میزبان می‌تواند برای ادامه، کار جدیدی اضافه کند.' }}</p>
          <NuxtLink to="/" class="button-secondary mt-7">بازگشت به خانه <Icon name="lucide:arrow-left" aria-hidden="true" /></NuxtLink>
        </div>
      </section>
      <aside class="min-w-0 space-y-6">
        <PokerParticipants :room="room" />
        <PokerTasks v-model:title="newTask" :room="room" :busy="busy" @add="submitTask" />
      </aside>
    </div>
  </div>
</template>
