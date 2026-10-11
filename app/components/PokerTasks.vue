<script setup lang="ts">
import type { RoomSnapshot } from '../../shared/poker'

defineProps<{ room: RoomSnapshot; busy: boolean }>()
const emit = defineEmits<{ add: [title: string] }>()
const title = defineModel<string>('title', { default: '' })
</script>

<template>
  <section class="panel p-5">
    <div class="mb-5 flex items-center justify-between gap-3">
      <h2 class="flex items-center gap-2 font-bold"><Icon name="lucide:list-checks" aria-hidden="true" /> مسیر جلسه</h2>
      <span class="text-xs text-muted">{{ room.tasks.filter((task) => task.status === 'completed').length.toLocaleString('fa-IR') }} از {{ room.tasks.length.toLocaleString('fa-IR') }}</span>
    </div>
    <ol class="max-h-80 overflow-y-auto space-y-2">
      <li v-for="task in room.tasks" :key="task.id" class="flex items-start gap-3 rounded-xl p-3" :class="task.status === 'active' ? 'bg-brand-50 text-brand-700' : 'text-muted'" :aria-current="task.status === 'active' ? 'step' : undefined">
        <span class="mt-0.5 shrink-0 text-sm">
          <Icon v-if="task.status === 'completed'" name="lucide:circle-check" class="text-brand-600" aria-label="تکمیل شده" />
          <Icon v-else-if="task.status === 'active'" name="lucide:circle-dot" aria-label="کار فعال" />
          <span v-else class="inline-block min-w-4 text-center">{{ (task.position + 1).toLocaleString('fa-IR') }}</span>
        </span>
        <span class="break-words text-sm leading-6" :class="task.status === 'active' ? 'font-bold' : ''">{{ task.title }}</span>
      </li>
    </ol>
    <form v-if="room.me.isHost" class="mt-5 border-t border-line pt-5" @submit.prevent="emit('add', title)">
      <label for="new-task" class="mb-2 block text-xs font-bold">یک کار دیگر اضافه کنید</label>
      <div class="flex gap-2">
        <input id="new-task" v-model="title" class="field min-w-0 flex-1 text-sm" placeholder="عنوان کار جدید" required maxlength="240" :disabled="busy" />
        <button type="submit" class="button-secondary px-3" aria-label="افزودن کار" :disabled="busy || !title.trim()">
          <Icon name="lucide:plus" aria-hidden="true" />
        </button>
      </div>
    </form>
  </section>
</template>
