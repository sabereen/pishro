<script setup lang="ts">
import type { PublicUser } from '#shared/scrum'

definePageMeta({ middleware: 'auth' })
const { user } = useAuth()
const name = ref(user.value?.name ?? '')
const { busy, run } = useAction()
async function save() {
  await run(async () => { user.value = await $fetch<PublicUser>('/api/auth/profile', { method: 'PATCH', body: { name: name.value } }) }, 'نام شما به‌روز شد')
}
</script>
<template>
  <section class="panel mx-auto max-w-lg p-7">
    <h1 class="text-2xl font-bold">حساب شما</h1>
    <p class="mt-3 text-sm text-muted" dir="ltr">{{ user?.email }}</p>
    <form class="mt-6 space-y-5" @submit.prevent="save">
      <label class="block text-sm">نام نمایشی<input v-model="name" class="field mt-2" required maxlength="80" /></label>
      <button class="button-primary" :disabled="busy">ذخیره تغییرات</button>
    </form>
  </section>
</template>
