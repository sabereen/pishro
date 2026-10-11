<script setup lang="ts">
import type { RoomSnapshot } from '../../shared/poker'
import { voteLabel } from '../../shared/poker'

defineProps<{ room: RoomSnapshot }>()
</script>

<template>
  <section class="panel p-5">
    <div class="mb-5 flex items-center justify-between gap-3">
      <h2 class="flex items-center gap-2 font-bold"><Icon name="lucide:users-round" aria-hidden="true" /> اعضای تیم</h2>
      <span class="text-xs text-muted">{{ room.participants.filter((person) => person.online).length.toLocaleString('fa-IR') }} نفر آنلاین</span>
    </div>
    <ul class="space-y-4">
      <li v-for="person in room.participants" :key="person.id" class="flex items-center gap-3">
        <span class="relative h-10 w-10 flex shrink-0 items-center justify-center rounded-2xl bg-canvas text-sm font-bold" aria-hidden="true">
          {{ person.name.slice(0, 1) }}
          <span class="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white" :class="person.online ? 'bg-brand-500' : 'bg-gray-300'" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block break-words text-sm font-bold">{{ person.name }} <span v-if="person.id === room.me.id" class="text-xs font-normal text-muted">(شما)</span></span>
          <span class="mt-1 block text-xs text-muted">{{ person.isHost ? 'میزبان · ' : '' }}{{ person.online ? 'آنلاین' : 'آفلاین' }}</span>
        </span>
        <span v-if="room.activeTask" class="h-9 min-w-9 flex shrink-0 items-center justify-center rounded-lg border px-2 text-sm font-bold" :class="person.hasVoted ? 'border-brand-100 bg-brand-50 text-brand-700' : 'border-line text-muted'" :aria-label="room.revealed && person.vote !== null ? `رأی: ${voteLabel(person.vote)}` : person.hasVoted ? 'رأی داده' : 'هنوز رأی نداده'" role="img">
          <template v-if="room.revealed && person.vote !== null">{{ voteLabel(person.vote) }}</template>
          <Icon v-else-if="person.hasVoted" name="lucide:check" aria-hidden="true" />
          <Icon v-else name="lucide:minus" aria-hidden="true" />
        </span>
      </li>
    </ul>
  </section>
</template>
