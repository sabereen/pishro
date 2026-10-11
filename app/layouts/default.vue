<script setup lang="ts">
const { user, logout } = useAuth()
const { run } = useAction()
</script>

<template>
  <div>
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-4">
      رفتن به محتوای اصلی
    </a>
    <header class="border-b border-line bg-white">
      <div class="mx-auto max-w-6xl flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <NuxtLink to="/" class="flex items-center gap-3 rounded-xl" aria-label="پیشرو، صفحه اصلی">
          <img src="/pishro-icon.png" alt="" width="48" height="48" class="h-12 w-12 rounded-xl" />
          <span>
            <span class="block text-xl font-bold">پیشرو</span>
            <span class="block text-xs text-muted">یک تیم، یک قدم جلوتر</span>
          </span>
        </NuxtLink>
        <div v-if="user" class="flex items-center gap-4 text-sm">
          <NuxtLink to="/projects" class="rounded-lg px-2 py-3">پروژه‌ها</NuxtLink>
          <NuxtLink to="/profile" class="rounded-lg px-2 py-3">{{ user.name }}</NuxtLink>
          <button class="h-11 w-11 rounded-xl hover:bg-canvas" aria-label="خروج از حساب" @click="run(logout)"><Icon name="lucide:log-out" aria-hidden="true" /></button>
        </div>
        <NuxtLink v-else to="/login" class="button-secondary text-sm">ورود به پیشرو</NuxtLink>
      </div>
    </header>
    <main id="main" class="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <slot />
    </main>
    <footer class="mx-auto max-w-6xl px-5 pb-8 text-center text-xs text-muted sm:px-8">
      پیشرو · گفت‌وگوی بهتر، برآورد روشن‌تر
    </footer>
  </div>
</template>
