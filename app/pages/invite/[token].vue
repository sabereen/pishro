<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const token = String(useRoute().params.token)
const { data, error } = await useFetch(`/api/invites/${token}`)
const { busy, run } = useAction()
async function accept() {
  await run(async () => {
    const invite = await $fetch(`/api/invites/${token}`, { method: 'POST', body: {} })
    await navigateTo(`/projects/${invite.projectId}/sprint`)
  })
}
</script>
<template><section class="panel mx-auto max-w-lg p-8 text-center"><Icon name="lucide:handshake" class="text-4xl text-brand-700" aria-hidden="true" /><h1 class="mt-5 text-2xl font-bold">{{ data ? `دعوت به ${data.name}` : 'این دعوت در دسترس نیست' }}</h1><p class="mt-4 text-sm leading-8 text-muted">{{ error ? requestError(error) : 'با پیوستن به پروژه می‌توانید کارها، اسپرینت و گزارش‌های تیم را ببینید.' }}</p><button v-if="data" class="button-primary mt-6" :disabled="busy" @click="accept">پیوستن به تیم</button><NuxtLink v-else to="/projects" class="button-secondary mt-6">پروژه‌های من</NuxtLink></section></template>
