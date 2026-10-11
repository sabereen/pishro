<script setup lang="ts">
import type { PublicUser } from '../../shared/scrum'

const props = defineProps<{ register?: boolean }>()
const name = ref('')
const email = ref('')
const password = ref('')
const { user } = useAuth()
const route = useRoute()
const { busy, error, run } = useAction()
async function submit() {
  await run(async () => {
    user.value = await $fetch<PublicUser>(props.register ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST', body: { name: name.value, email: email.value, password: password.value },
    })
    const next = typeof route.query.next === 'string' ? route.query.next : ''
    await navigateTo(next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/projects')
  })
}
</script>

<template>
  <section class="panel mx-auto max-w-md p-6 sm:p-8">
    <span class="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-2 text-xs text-brand-700"><Icon name="lucide:sprout" aria-hidden="true" /> یک تیم، یک قدم جلوتر</span>
    <h1 class="text-2xl font-bold">{{ register ? 'جای شما در تیم خالی است' : 'خوش برگشتید' }}</h1>
    <p class="mt-3 text-sm leading-8 text-muted">{{ register ? 'حساب بسازید و کارهای تیم را کنار هم پیش ببرید.' : 'وارد شوید و ببینید تیم امروز کجای مسیر است.' }}</p>
    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <label v-if="register" class="block text-sm">نام شما<input v-model="name" class="field mt-2" required maxlength="80" autocomplete="name" :disabled="busy" /></label>
      <label class="block text-sm">ایمیل<input v-model="email" class="field mt-2 text-left" type="email" dir="ltr" required maxlength="254" autocomplete="email" :disabled="busy" /></label>
      <label class="block text-sm">رمز عبور<input v-model="password" class="field mt-2 text-left" type="password" dir="ltr" required :minlength="register ? 10 : 1" maxlength="128" :autocomplete="register ? 'new-password' : 'current-password'" :disabled="busy" /></label>
      <p v-if="register" class="text-xs text-muted">حداقل ۱۰ نویسه؛ یک عبارت طولانی و منحصربه‌فرد انتخاب کنید.</p>
      <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-3 text-sm leading-7 text-red-700">{{ error }}</p>
      <button class="button-primary w-full" :disabled="busy">{{ busy ? 'کمی صبر کنید…' : register ? 'ساخت حساب' : 'ورود به حساب' }}<Icon name="lucide:arrow-left" aria-hidden="true" /></button>
    </form>
    <p class="mt-6 text-center text-sm text-muted">
      {{ register ? 'حساب دارید؟' : 'تازه به تیم پیوسته‌اید؟' }}
      <NuxtLink :to="{ path: register ? '/login' : '/register', query: route.query.next ? { next: route.query.next } : {} }" class="rounded-lg p-2 font-bold text-brand-700">{{ register ? 'وارد شوید' : 'ثبت‌نام کنید' }}</NuxtLink>
    </p>
  </section>
</template>
