<script setup lang="ts">
const mode = ref<'create' | 'join'>('create')
const name = ref('')
const participantName = ref('')
const taskTitles = ref('')
const invite = ref('')
const busy = ref(false)
const error = ref('')

async function createRoom() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const room = await $fetch('/api/rooms', {
      method: 'POST',
      body: { name: name.value, participantName: participantName.value, tasks: taskTitles.value },
    })
    await navigateTo(`/rooms/${room.id}`)
  } catch (cause) {
    error.value = requestError(cause)
  } finally {
    busy.value = false
  }
}

async function openInvite() {
  error.value = ''
  const value = invite.value.trim()
  const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i
  let id = value
  if (!uuid.test(id)) {
    try {
      const url = new URL(value, window.location.origin)
      id = url.pathname.match(/^\/rooms\/([^/]+)\/?$/)?.[1] ?? ''
    } catch {
      id = ''
    }
  }
  if (!uuid.test(id)) {
    error.value = 'لینک دعوت یا شناسه جلسه را کامل وارد کنید.'
    return
  }
  await navigateTo(`/rooms/${id}`)
}
</script>

<template>
  <div class="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
    <section class="pt-3 lg:pt-10">
      <span class="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-4 py-2 text-sm text-brand-700">
        <Icon name="lucide:sparkles" aria-hidden="true" />
        برنامه‌ریزی، با صدای همه
      </span>
      <h1 class="mt-6 text-4xl font-bold leading-relaxed sm:text-5xl sm:leading-relaxed">
        قدم بعدی تیم را
        <span class="block text-brand-600">با هم بردارید.</span>
      </h1>
      <p class="mt-5 max-w-lg text-base leading-9 text-muted">
        یک جلسه بسازید، تیم را دعوت کنید و با پلنینگ پوکر به برآورد مشترک برسید.
        همه هم‌زمان رأی می‌دهند؛ گفت‌وگو از جایی شروع می‌شود که کارت‌ها رو می‌شوند.
      </p>

      <div class="mt-8 flex flex-wrap gap-3 text-sm text-muted">
        <span class="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
          <Icon name="lucide:link" class="text-brand-600" aria-hidden="true" /> یک لینک برای همه
        </span>
        <span class="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
          <Icon name="lucide:eye-off" class="text-brand-600" aria-hidden="true" /> رأی‌های مستقل
        </span>
        <span class="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
          <Icon name="lucide:radio" class="text-brand-600" aria-hidden="true" /> همگام و زنده
        </span>
      </div>

      <div class="mt-10 rounded-3xl border border-brand-100 bg-brand-50 p-6" aria-hidden="true">
        <div class="flex items-center gap-3 text-sm font-bold text-brand-700">
          <span class="h-2 w-2 rounded-full bg-brand-500" /> هر دیدگاه، یک تکه از تصویر
        </div>
        <div dir="ltr" class="mt-7 flex justify-center gap-3">
          <div class="h-28 w-18 flex rotate-[-8deg] items-center justify-center rounded-2xl border border-line bg-white text-3xl font-bold text-ink sm:w-22">3</div>
          <div class="h-28 w-18 flex translate-y-[-8px] items-center justify-center rounded-2xl border border-brand-600 bg-brand-600 text-3xl font-bold text-white sm:w-22">5</div>
          <div class="h-28 w-18 flex rotate-[8deg] items-center justify-center rounded-2xl border border-line bg-white text-3xl font-bold text-ink sm:w-22">8</div>
        </div>
        <p class="mt-6 text-center text-sm leading-7 text-brand-700">اول فکر کنیم، بعد کارت‌ها را رو کنیم.</p>
      </div>
    </section>

    <section class="panel p-5 sm:p-8" aria-label="شروع جلسه">
      <div class="mb-7 grid grid-cols-2 gap-2 rounded-2xl bg-canvas p-1.5">
        <button type="button" :aria-pressed="mode === 'create'" class="rounded-xl px-3 py-3 text-sm font-bold transition-colors" :class="mode === 'create' ? 'bg-white text-ink' : 'text-muted hover:text-ink'" @click="mode = 'create'; error = ''">
          ساخت جلسه
        </button>
        <button type="button" :aria-pressed="mode === 'join'" class="rounded-xl px-3 py-3 text-sm font-bold transition-colors" :class="mode === 'join' ? 'bg-white text-ink' : 'text-muted hover:text-ink'" @click="mode = 'join'; error = ''">
          پیوستن به تیم
        </button>
      </div>

      <form v-if="mode === 'create'" class="space-y-5" @submit.prevent="createRoom">
        <div>
          <h2 class="text-xl font-bold">از یک گفت‌وگوی خوب شروع کنیم</h2>
          <p class="mt-2 text-sm leading-7 text-muted">شما میزبان هستید؛ بعد از ساخت جلسه، لینک دعوت را با تیم به اشتراک بگذارید.</p>
        </div>
        <div>
          <label for="room-name" class="mb-2 block text-sm font-bold">نام جلسه</label>
          <input id="room-name" v-model="name" class="field" placeholder="مثلاً برنامه‌ریزی اسپرینت ۱۲" required maxlength="120" :disabled="busy" />
        </div>
        <div>
          <label for="your-name" class="mb-2 block text-sm font-bold">نام شما</label>
          <input id="your-name" v-model="participantName" class="field" placeholder="تیم شما را با چه نامی می‌شناسد؟" required maxlength="60" autocomplete="nickname" :disabled="busy" />
        </div>
        <div>
          <label for="tasks" class="mb-2 block text-sm font-bold">کارهایی که برآورد می‌کنید</label>
          <textarea id="tasks" v-model="taskTitles" class="field min-h-32 resize-y leading-8" placeholder="طراحی صفحه ورود&#10;افزودن جست‌وجو&#10;بهبود اعلان‌ها" required maxlength="12000" :disabled="busy" aria-describedby="tasks-help" />
          <p id="tasks-help" class="mt-2 text-xs leading-6 text-muted">هر کار در یک خط · حداکثر ۵۰ کار برای شروع</p>
        </div>
        <button type="submit" class="button-primary w-full" :disabled="busy">
          <Icon name="lucide:plus" aria-hidden="true" />
          {{ busy ? 'در حال ساخت جلسه…' : 'بزن بریم، ساخت جلسه' }}
          <Icon name="lucide:arrow-left" class="mr-auto" aria-hidden="true" />
        </button>
        <p class="text-center text-xs leading-6 text-muted">بدون ثبت‌نام · لینک جلسه را فقط با تیم خود به اشتراک بگذارید</p>
      </form>

      <form v-else class="space-y-5" @submit.prevent="openInvite">
        <div>
          <h2 class="text-xl font-bold">تیم منتظر شماست</h2>
          <p class="mt-2 text-sm leading-7 text-muted">لینکی را که میزبان فرستاده وارد کنید؛ در قدم بعد نام خود را انتخاب می‌کنید.</p>
        </div>
        <div>
          <label for="invite" class="mb-2 block text-sm font-bold">لینک دعوت یا شناسه جلسه</label>
          <input id="invite" v-model="invite" dir="ltr" class="field text-left" placeholder="https://…/rooms/…" required autocomplete="off" />
        </div>
        <button type="submit" class="button-primary w-full">
          <Icon name="lucide:log-in" aria-hidden="true" /> رفتن به جلسه
        </button>
      </form>

      <p v-if="error" role="alert" class="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-700">{{ error }}</p>
    </section>
  </div>
</template>
