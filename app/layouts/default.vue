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
          <img src="/pishro-icon.png" alt="" width="48" height="48" class="h-10 w-10 rounded-xl sm:h-12 sm:w-12" />
          <span>
            <span class="block text-xl font-bold">پیشرو</span>
            <span class="hidden text-xs text-muted sm:block">یک تیم، یک قدم جلوتر</span>
          </span>
        </NuxtLink>
        <div v-if="user" class="flex items-center gap-2 text-sm sm:gap-4">
          <NuxtLink to="/projects" class="rounded-lg px-1 py-3 text-xs sm:px-2 sm:text-sm">پروژه‌ها</NuxtLink>
          <NuxtLink to="/profile" class="flex min-w-0 items-center gap-2 rounded-lg py-2" :aria-label="`حساب ${user.name}`"><UserAvatar :name="user.name" :src="user.avatarUrl" :size="36" /><span class="hidden max-w-36 truncate sm:block">{{ user.name }}</span></NuxtLink>
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
