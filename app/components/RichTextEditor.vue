<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import {
  documentToMarkdown,
  markdownToDocument,
  normalizeDocument,
  richTextExtensions,
  safeLink,
} from '~/utils/rich-text'
import type { TextDirection } from '~/utils/rich-text'

const props = withDefaults(
  defineProps<{
    label?: string
    placeholder?: string
    maxlength?: number
    disabled?: boolean
  }>(),
  { label: 'توضیحات', placeholder: 'متن خود را بنویسید…', maxlength: 10000, disabled: false },
)
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ validity: [valid: boolean] }>()
const sourceMode = ref(false)
const showLink = ref(false)
const linkUrl = ref('')
const linkError = ref('')
const limitReached = ref(false)
const revision = ref(0)
const sourceInput = ref<HTMLTextAreaElement>()
const editorId = useId()
const linkId = useId()
let lastEmitted = model.value
let originalMarkdown = model.value
let originalDocument = ''

const LengthLimit = Extension.create({
  name: 'markdownLengthLimit',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('markdownLengthLimit'),
        filterTransaction(transaction, state) {
          if (!transaction.docChanged || transaction.getMeta('externalContent')) return true
          const next = documentToMarkdown(transaction.doc.toJSON()).length
          const previous = documentToMarkdown(state.doc.toJSON()).length
          if (next <= props.maxlength || next <= previous) return true
          limitReached.value = true
          return false
        },
      }),
    ]
  },
})

const editor = useEditor({
  extensions: [...richTextExtensions(), LengthLimit],
  content: markdownToDocument(model.value),
  editable: !props.disabled,
  editorProps: {
    attributes: {
      id: editorId,
      role: 'textbox',
      'aria-label': props.label,
      'aria-multiline': 'true',
      dir: 'auto',
    },
  },
  onCreate({ editor: instance }) {
    originalDocument = JSON.stringify(instance.getJSON())
    revision.value++
  },
  onTransaction() {
    revision.value++
  },
  onUpdate({ editor: instance }) {
    const json = instance.getJSON()
    const next =
      JSON.stringify(json) === originalDocument ? originalMarkdown : documentToMarkdown(json)
    lastEmitted = next
    model.value = next
    limitReached.value = false
  },
})

const currentDirection = computed(() => {
  void revision.value
  return (editor.value?.state.selection.$from.parent.attrs.dir ?? 'auto') as TextDirection
})
const inCodeBlock = computed(() => {
  void revision.value
  return editor.value?.isActive('codeBlock') ?? false
})
const invalid = computed(() => model.value.length > props.maxlength)
watch(invalid, (value) => emit('validity', !value), { immediate: true })
watch(
  () => props.disabled,
  (value) => editor.value?.setEditable(!value),
)
watch(model, (value) => {
  if (value === lastEmitted) return
  lastEmitted = value
  originalMarkdown = value
  if (!sourceMode.value) loadMarkdown(value)
})
function loadMarkdown(value: string) {
  if (!editor.value) return
  const document = markdownToDocument(value)
  if (JSON.stringify(normalizeDocument(editor.value.getJSON())) !== JSON.stringify(document)) {
    editor.value
      .chain()
      .setMeta('externalContent', true)
      .setContent(document, { emitUpdate: false })
      .run()
  }
  originalDocument = JSON.stringify(editor.value.getJSON())
  originalMarkdown = value
}
async function toggleMode() {
  sourceMode.value = !sourceMode.value
  showLink.value = false
  if (sourceMode.value) {
    await nextTick()
    sourceInput.value?.focus()
  } else {
    loadMarkdown(model.value)
    editor.value?.commands.focus()
  }
}
function setDirection(event: Event) {
  const dir = (event.target as HTMLSelectElement).value as TextDirection
  if (!['auto', 'rtl', 'ltr'].includes(dir) || !editor.value) return
  editor.value
    .chain()
    .focus()
    .command(({ tr, state }) => {
      const { from, to } = state.selection
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === 'paragraph' || node.type.name === 'heading') {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir })
        }
      })
      return true
    })
    .run()
}
function openLink() {
  linkUrl.value = editor.value?.getAttributes('link').href ?? ''
  linkError.value = ''
  showLink.value = !showLink.value
}
function applyLink() {
  const href = linkUrl.value.trim()
  if (href && !safeLink(href)) {
    linkError.value = 'لینک باید با https://، http:// یا mailto: شروع شود.'
    return
  }
  const chain = editor.value?.chain().focus().extendMarkRange('link')
  if (href) chain?.setLink({ href }).run()
  else chain?.unsetLink().run()
  showLink.value = false
}
const tools = [
  {
    label: 'پررنگ (Ctrl+B)',
    icon: 'lucide:bold',
    active: 'bold',
    run: () => editor.value?.chain().focus().toggleBold().run(),
  },
  {
    label: 'مورب (Ctrl+I)',
    icon: 'lucide:italic',
    active: 'italic',
    run: () => editor.value?.chain().focus().toggleItalic().run(),
  },
  {
    label: 'عنوان',
    icon: 'lucide:heading-2',
    active: 'heading',
    run: () => editor.value?.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'فهرست',
    icon: 'lucide:list',
    active: 'bulletList',
    run: () => editor.value?.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'فهرست شماره‌دار',
    icon: 'lucide:list-ordered',
    active: 'orderedList',
    run: () => editor.value?.chain().focus().toggleOrderedList().run(),
  },
  {
    label: 'نقل‌قول',
    icon: 'lucide:quote',
    active: 'blockquote',
    run: () => editor.value?.chain().focus().toggleBlockquote().run(),
  },
  {
    label: 'کد درون متن',
    icon: 'lucide:code',
    active: 'code',
    run: () => editor.value?.chain().focus().toggleCode().run(),
  },
  {
    label: 'بلوک کد',
    icon: 'lucide:square-code',
    active: 'codeBlock',
    run: () => editor.value?.chain().focus().toggleCodeBlock().run(),
  },
]
function isActive(name: string) {
  void revision.value
  return editor.value?.isActive(name) ?? false
}
function canUndo() {
  void revision.value
  return editor.value?.can().undo() ?? false
}
function canRedo() {
  void revision.value
  return editor.value?.can().redo() ?? false
}
</script>

<template>
  <div
    class="overflow-hidden rounded-xl border border-line bg-white text-sm focus-within:border-brand-500"
  >
    <div
      class="flex flex-wrap items-center gap-1 border-b border-line bg-canvas p-2"
      role="group"
      :aria-label="`ابزارهای ${label}`"
    >
      <template v-if="!sourceMode">
        <button
          v-for="tool in tools"
          :key="tool.active"
          type="button"
          class="editor-tool"
          :class="isActive(tool.active) ? 'bg-brand-100 text-brand-800' : ''"
          :title="tool.label"
          :aria-label="tool.label"
          :aria-pressed="isActive(tool.active)"
          :disabled="disabled || !editor"
          @mousedown.prevent
          @click="tool.run"
        >
          <Icon :name="tool.icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="editor-tool"
          :class="isActive('link') ? 'bg-brand-100 text-brand-800' : ''"
          title="لینک"
          aria-label="لینک"
          :aria-expanded="showLink"
          :disabled="disabled || !editor"
          @mousedown.prevent
          @click="openLink"
        >
          <Icon name="lucide:link" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="editor-tool"
          title="واگرد (Ctrl+Z)"
          aria-label="واگرد"
          :disabled="disabled || !canUndo()"
          @mousedown.prevent
          @click="editor?.chain().focus().undo().run()"
        >
          <Icon name="lucide:undo-2" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="editor-tool"
          title="انجام دوباره (Ctrl+Shift+Z)"
          aria-label="انجام دوباره"
          :disabled="disabled || !canRedo()"
          @mousedown.prevent
          @click="editor?.chain().focus().redo().run()"
        >
          <Icon name="lucide:redo-2" aria-hidden="true" />
        </button>
        <select
          class="min-h-9 rounded-lg border border-line bg-white px-2 text-xs"
          aria-label="جهت پاراگراف"
          :value="inCodeBlock ? 'ltr' : currentDirection"
          :disabled="disabled || !editor || inCodeBlock"
          @change="setDirection"
        >
          <option value="auto">خودکار</option>
          <option value="rtl">راست‌به‌چپ</option>
          <option value="ltr">چپ‌به‌راست</option>
        </select>
      </template>
      <button
        type="button"
        class="ms-auto min-h-9 rounded-lg px-2 text-xs font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-40"
        :aria-pressed="sourceMode"
        :disabled="disabled"
        @click="toggleMode"
      >
        {{ sourceMode ? 'ویرایش بصری' : 'Markdown' }}
      </button>
    </div>
    <div v-if="showLink" class="flex flex-wrap items-center gap-2 border-b border-line p-3">
      <label :for="linkId" class="sr-only">نشانی لینک</label>
      <input
        :id="linkId"
        v-model="linkUrl"
        class="field min-w-0 flex-1 text-left text-sm"
        dir="ltr"
        placeholder="https://…"
        @keydown.enter.prevent="applyLink"
        @keydown.esc.prevent="showLink = false"
      />
      <button type="button" class="button-secondary text-xs" @click="applyLink">
        {{ linkUrl ? 'ثبت لینک' : 'حذف لینک' }}
      </button>
      <p v-if="linkError" class="w-full text-xs text-red-700" role="alert">{{ linkError }}</p>
    </div>
    <textarea
      v-if="sourceMode"
      ref="sourceInput"
      v-model="model"
      class="min-h-44 w-full resize-y bg-white p-4 font-mono text-sm leading-7 outline-none"
      dir="auto"
      :aria-label="`${label} — سورس Markdown`"
      :aria-invalid="invalid"
      :maxlength="maxlength"
      :disabled="disabled"
      :placeholder="placeholder"
    />
    <div v-else class="relative">
      <EditorContent v-if="editor" :editor="editor" class="rich-text editor-content min-h-44" />
      <RichTextViewer v-else :content="model" class="min-h-44 p-4" />
      <p
        v-if="editor?.isEmpty"
        class="pointer-events-none absolute start-4 top-4 text-muted"
        aria-hidden="true"
      >
        {{ placeholder }}
      </p>
    </div>
    <div
      class="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-muted"
      aria-live="polite"
    >
      <span :class="invalid || limitReached ? 'text-red-700' : ''">{{
        invalid || limitReached
          ? 'متن بیش از حد مجاز است.'
          : sourceMode
            ? 'سورس Markdown'
            : 'فارسی و English · جهت هر پاراگراف مستقل است'
      }}</span>
      <span class="shrink-0" dir="ltr"
        >{{ model.length.toLocaleString('fa-IR') }} / {{ maxlength.toLocaleString('fa-IR') }}</span
      >
    </div>
  </div>
</template>
