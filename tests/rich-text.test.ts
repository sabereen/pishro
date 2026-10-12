import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getSchema } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import { EditorState } from '@tiptap/pm/state'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import {
  documentToMarkdown,
  markdownToDocument,
  normalizeDocument,
  renderRichText,
  richTextExtensions,
  safeLink,
} from '../app/utils/rich-text.ts'
import { markdownInput } from '../server/utils/validation.ts'

const RLM = '\u200F'
const LRM = '\u200E'
function blocks(node: JSONContent): JSONContent[] {
  return [node, ...(node.content ?? []).flatMap(blocks)].filter((item) =>
    ['paragraph', 'heading', 'codeBlock'].includes(item.type ?? ''),
  )
}
function text(node: JSONContent): string {
  return node.text ?? (node.content ?? []).map(text).join('')
}
function roundTrip(markdown: string) {
  const document = markdownToDocument(markdown)
  const saved = documentToMarkdown(document)
  assert.deepEqual(markdownToDocument(saved), document)
  assert.equal(documentToMarkdown(markdownToDocument(saved)), saved)
  return { document, saved }
}

for (const [name, mark, dir] of [
  ['Auto', '', 'auto'],
  ['RTL', RLM, 'rtl'],
  ['LTR', LRM, 'ltr'],
]) {
  test(`${name}: marker after syntax, real dir attributes, no editable metadata`, () => {
    const markdown = `## ${mark}عنوان English\n\n${mark}می‌نویسیم **bold** و *italic*\n\n- ${mark}آیتم\n  - ${mark}nested\n\n> ${mark}نقل‌قول\n\n3. ${mark}numbered`
    const { document, saved } = roundTrip(markdown)
    for (const block of blocks(document)) {
      assert.equal(block.attrs?.dir, dir)
      assert.doesNotMatch(text(block), /[\u200E\u200F]/)
    }
    if (mark) {
      assert.match(saved, new RegExp(`^## ${mark}`, 'm'))
      assert.match(saved, new RegExp(`^- ${mark}`, 'm'))
      assert.match(saved, new RegExp(`^  - ${mark}`, 'm'))
      assert.match(saved, new RegExp(`^> ${mark}`, 'm'))
      assert.match(saved, new RegExp(`^3\\. ${mark}`, 'm'))
    } else assert.doesNotMatch(saved, /[\u200E\u200F]/)
  })
}

test('independent directions in mixed nested lists and quotes', () => {
  const { document } = roundTrip(
    `- ${RLM}والد\n  1. ${LRM}English\n  2. فرزند\n\n> ${LRM}quote\n>\n> ${RLM}فارسی\n>\n> > inner`,
  )
  assert.deepEqual(
    blocks(document).map((block) => block.attrs?.dir),
    ['rtl', 'ltr', 'auto', 'ltr', 'rtl', 'auto'],
  )
})

test('repeated direction changes replace markers, including duplicate pasted metadata', () => {
  let document = markdownToDocument(`## ${RLM}${RLM}${LRM}**Hello**`)
  assert.equal(blocks(document)[0]!.attrs?.dir, 'ltr')
  for (const dir of ['rtl', 'ltr', 'auto', 'rtl', 'auto', 'ltr']) {
    document.content![0]!.attrs!.dir = dir
    const saved = documentToMarkdown(document)
    assert.equal((saved.match(/[\u200E\u200F]/g) ?? []).length, dir === 'auto' ? 0 : 1)
    document = markdownToDocument(saved)
    assert.equal(blocks(document)[0]!.attrs?.dir, dir)
    assert.equal(text(document), 'Hello')
  }
})

test('markers spanning differently marked text nodes are removed without losing formatting', () => {
  const document = normalizeDocument({
    type: 'paragraph',
    content: [
      { type: 'text', text: RLM, marks: [{ type: 'bold' }] },
      { type: 'text', text: LRM + 'hello', marks: [{ type: 'italic' }] },
    ],
  })
  assert.equal(document.attrs?.dir, 'ltr')
  assert.deepEqual(document.content, [{ type: 'text', text: 'hello', marks: [{ type: 'italic' }] }])
})

test('code blocks stay LTR and preserve code characters, indentation and Unicode markers', () => {
  const { document, saved } = roundTrip(
    `
\`\`\`ts
${RLM}const متن = 'می‌شود'
  // ${LRM}hello
\`\`\``.trim(),
  )
  assert.equal(blocks(document)[0]!.attrs?.dir, 'ltr')
  assert.match(saved, new RegExp(RLM + 'const'))
  assert.match(saved, /  \/\//)
})

test('ZWNJ, mixed Persian/English, inline code, links, breaks and blank paragraphs survive', () => {
  const markdown = `${RLM}می‌توانیم **Vue 3** و *فارسی* را با \`const x = 1\` بنویسیم.  \nخط بعد\n\n\n\n[مستندات](https://example.com/docs?q=1&lang=fa)\n\n---`
  const { document } = roundTrip(markdown)
  assert.ok(text(document).includes('می‌توانیم'))
  assert.ok(text(document).includes('const x = 1'))
  assert.ok(document.content!.some((node) => node.type === 'horizontalRule'))
})

test('explicit empty blocks retain their direction', () => {
  const { document } = roundTrip(`${RLM}\n\n${LRM}`)
  assert.deepEqual(
    blocks(document).map((node) => [text(node), node.attrs?.dir]),
    [
      ['', 'rtl'],
      ['', 'ltr'],
    ],
  )
})

test('literal Markdown punctuation, HTML and leading spaces retain text through serialization', () => {
  const document = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { dir: 'auto' },
        content: [{ type: 'text', text: '# title * literal <b>html</b> می‌شود' }],
      },
    ],
  }
  assert.equal(text(markdownToDocument(documentToMarkdown(document))), text(document))
})

test('ProseMirror pasted markers become attributes and disappear from editing text', () => {
  const extensions = richTextExtensions()
  const schema = getSchema(extensions)
  const extension = extensions.find((item) => item.name === 'blockDirection')!
  // This plugin has no editor/DOM dependency, so exercise real transactions in Node.
  const plugins = extension.config.addProseMirrorPlugins!.call({} as never)
  let state = EditorState.create({
    schema,
    doc: schema.nodeFromJSON(markdownToDocument('- parent')),
    plugins,
  })
  const applied = state.applyTransaction(state.tr.insertText(RLM + LRM + 'English', 3))
  state = applied.state
  assert.equal(applied.transactions.length, 2)
  assert.equal(state.doc.firstChild!.firstChild!.firstChild!.attrs.dir, 'ltr')
  assert.equal(state.doc.firstChild!.firstChild!.attrs.dir, 'ltr')
  assert.doesNotMatch(state.doc.textContent, /[\u200E\u200F]/)
  assert.match(documentToMarkdown(state.doc.toJSON()), new RegExp(`^- ${LRM}`))
})

test('display escapes raw HTML and rejects unsafe Markdown links on the server', async () => {
  for (const markdown of [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<strong onclick="alert(1)">hello</strong>',
    '[click](javascript:alert%281%29)',
    '[click](data:text/html,evil)',
    '[click](vbscript:evil)',
    '[click](java&#x73;cript:evil)',
  ]) {
    const document = markdownToDocument(markdown)
    const html = await renderToString(createSSRApp({ render: () => renderRichText(document) }))
    assert.doesNotMatch(html, /<(script|img|strong)\b|href="(javascript|data|vbscript):/i)
  }
  const html = await renderToString(
    createSSRApp({
      render: () =>
        renderRichText(markdownToDocument(`## ${RLM}سلام\n\n[Link](https://example.com)`)),
    }),
  )
  assert.match(html, /<h2 dir="rtl">سلام<\/h2>/)
  assert.match(html, /rel="noopener noreferrer"/)
})

test('link validation rejects whitespace, control characters and protocol-relative URLs', () => {
  for (const link of [
    'javascript:evil',
    'java\nscript:evil',
    '//evil.test',
    '/\\evil.test',
    'data:text/html,x',
    'https://test/\u0000',
  ])
    assert.equal(safeLink(link), undefined)
  for (const link of ['https://example.com/فارسی', 'mailto:test@example.com', '/docs', '#heading'])
    assert.equal(safeLink(link), link)
})

test('server keeps exact Markdown whitespace and enforces the complete 10000-character limit', () => {
  const markdown = '  indented\n\ntext  \nnext\n'
  assert.equal(markdownInput(markdown), markdown)
  assert.equal(markdownInput(''), '')
  assert.equal(markdownInput('x'.repeat(10000)).length, 10000)
  // Nuxt's auto-imported createError is supplied only for validation failures.
  Object.assign(globalThis, {
    createError: (details: { message: string }) => new Error(details.message),
  })
  for (const invalid of [' '.repeat(10001), 'x'.repeat(10001), null, 12, {}, []])
    assert.throws(() => markdownInput(invalid))
})

test('literal block prefixes, indentation and unsupported table syntax remain text', () => {
  for (const value of [
    '# title',
    '1. item',
    '2) item',
    '- item',
    '+ item',
    '- - -',
    '===',
    '    code',
    '\tcode',
    'a | b\n--- | ---',
    '~~literal~~',
  ]) {
    const document = {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { dir: 'auto' }, content: [{ type: 'text', text: value }] },
      ],
    }
    const restored = markdownToDocument(documentToMarkdown(document))
    assert.equal(restored.content![0]!.type, 'paragraph', value)
    assert.equal(text(restored), value)
  }
})
