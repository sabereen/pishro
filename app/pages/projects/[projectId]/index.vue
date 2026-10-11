<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
await navigateTo(`/projects/${String(useRoute().params.projectId)}/sprint`, { replace: true })
</script>
<template><div class="p-8 text-center text-sm text-muted">در حال باز کردن اسپرینت…</div></template>
