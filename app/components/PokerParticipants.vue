<script setup lang="ts">
import type { PokerSnapshot } from '#shared/models'

const props = defineProps<{ snapshot: PokerSnapshot; busy: boolean }>()
const emit = defineEmits<{ action: [action: string, fields?: Record<string, unknown>] }>()
const search = ref('')
const canManage = computed(
  () => props.snapshot.me.facilitator && props.snapshot.session.status !== 'finalized',
)
const candidates = computed(() =>
  props.snapshot.availableMembers.filter((member) =>
    member.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()),
  ),
)
</script>

<template>
  <div>
    <p v-if="canManage" class="mb-4 text-xs leading-7 text-muted">
      اعضا را همین‌جا اضافه یا از جلسه خارج کنید. عضویت آن‌ها در پروژه حفظ می‌شود.
    </p>
    <ul class="space-y-3">
      <li
        v-for="person in snapshot.participants"
        :key="person.id"
        class="flex items-center gap-3 rounded-xl border border-line p-3"
      >
        <UserAvatar :name="person.name" :src="person.avatarUrl" :size="36" />
        <div class="min-w-0 flex-1">
          <p class="break-words text-sm font-bold">
            {{ person.name }}{{ person.id === snapshot.me.id ? ' (شما)' : '' }}
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ person.id === snapshot.session.facilitatorId ? 'تسهیل‌گر · ' : ''
            }}{{ person.online ? 'آنلاین' : person.joined ? 'آفلاین' : 'هنوز وارد نشده' }}
          </p>
        </div>
        <button
          v-if="canManage && person.id !== snapshot.session.facilitatorId"
          type="button"
          class="min-h-11 shrink-0 rounded-lg px-3 text-xs text-red-700 hover:bg-red-50"
          :aria-label="`حذف ${person.name} از جلسه`"
          :disabled="busy"
          @click="emit('action', 'removeParticipant', { userId: person.id })"
        >
          حذف از جلسه
        </button>
      </li>
    </ul>
    <section v-if="canManage" class="mt-5 border-t border-line pt-5">
      <h3 class="text-sm font-bold">افزودن عضو پروژه</h3>
      <p class="mt-2 text-xs leading-7 text-muted">
        {{
          snapshot.session.status === 'reveal' || snapshot.session.status === 'review'
            ? 'عضو جدید از دور بعد رأی می‌دهد.'
            : 'عضو جدید می‌تواند به رأی‌گیری جاری بپیوندد.'
        }}
        هر جلسه حداکثر ۵۰ نفر دارد.
      </p>
      <input
        v-model="search"
        type="search"
        class="field my-3 text-sm"
        placeholder="جست‌وجوی اعضای پروژه…"
        aria-label="جست‌وجوی اعضا برای افزودن به جلسه"
      />
      <ul class="max-h-60 overflow-y-auto space-y-2">
        <li
          v-for="member in candidates"
          :key="member.id"
          class="flex items-center gap-3 rounded-xl bg-canvas p-3"
        >
          <UserAvatar :name="member.name" :src="member.avatarUrl" :size="32" /><span
            class="min-w-0 flex-1 break-words text-sm"
            >{{ member.name }}</span
          ><button
            type="button"
            class="button-secondary shrink-0 text-xs"
            :disabled="busy || snapshot.participants.length >= 50"
            :aria-label="`افزودن ${member.name} به جلسه`"
            @click="emit('action', 'addParticipant', { userId: member.id })"
          >
            <Icon name="lucide:plus" aria-hidden="true" />افزودن
          </button>
        </li>
      </ul>
      <p v-if="!candidates.length" class="py-3 text-xs leading-7 text-muted">
        {{
          snapshot.availableMembers.length
            ? 'عضوی با این نام پیدا نشد.'
            : 'همه اعضای پروژه در جلسه هستند.'
        }}
      </p>
    </section>
  </div>
</template>
