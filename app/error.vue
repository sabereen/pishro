<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()
</script>

<template>
  <main class="min-h-screen flex items-center justify-center p-5" dir="rtl">
    <section class="panel w-full max-w-md p-8 text-center">
      <img src="/pishro-icon.png" alt="پیشرو" width="72" height="72" class="mx-auto rounded-2xl" />
      <p class="mt-6 text-sm text-muted">{{ error.statusCode }}</p>
      <h1 class="mt-3 text-2xl font-bold">{{ error.statusCode === 404 ? 'این صفحه پیدا نشد' : 'کمی از مسیر خارج شدیم' }}</h1>
      <p class="mt-4 text-sm leading-8 text-muted">از صفحه اصلی دوباره شروع کنید.</p>
      <button type="button" class="button-primary mt-6" @click="clearError({ redirect: '/' })">بازگشت به خانه</button>
    </section>
  </main>
</template>
