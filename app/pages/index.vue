<script setup lang="ts">
const { user, load } = useAuth()
try { await load() } catch { user.value = null }
await navigateTo(user.value ? '/projects' : '/login', { replace: true })
</script>
<template><div class="p-8 text-center text-sm text-muted">در حال ورود به پیشرو…</div></template>
