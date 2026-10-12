import { Extension } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import { Markdown, MarkdownManager } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import Paragraph from '@tiptap/extension-paragraph'
import { Tokenizer } from 'marked'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { h } from 'vue'
import type { VNodeChild } from 'vue'

export type TextDirection = 'auto' | 'rtl' | 'ltr'
export const directionMarks = { rtl: '\u200F', ltr: '\u200E' } as const
const leadingMarks = /^[\u200E\u200F]+/
const textBlocks = new Set(['paragraph', 'heading'])
// Use Marked's normal Markdown grammar, but treat raw HTML as literal text.
const tokenizer = new Tokenizer()
tokenizer.html = () => undefined
tokenizer.tag = () => undefined
// Unsupported table/strikethrough syntax stays readable text instead of losing content.
tokenizer.table = () => undefined
tokenizer.del = () => undefined
const markedOptions = { tokenizer }

export function safeLink(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    [...value].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)
  )
    return
  if (/^(https?:\/\/|mailto:)/i.test(value) || /^(\/(?![/\\])|#)/.test(value)) return value
}

function direction(value: unknown): TextDirection {
  return value === 'rtl' || value === 'ltr' ? value : 'auto'
}

/** Markers are storage metadata only; never strip ZWNJ or markers inside code/text. */
export function normalizeDocument(node: JSONContent): JSONContent {
  const result = { ...node }
  if (node.attrs) result.attrs = { ...node.attrs }
  if (node.content) result.content = node.content.map(normalizeDocument)
  if (textBlocks.has(node.type ?? '')) {
    let marks = ''
    while (result.content?.[0]?.type === 'text') {
      const first = result.content[0]
      const prefix = first.text?.match(leadingMarks)?.[0]
      if (!prefix) break
      marks += prefix
      first.text = first.text!.slice(prefix.length)
      if (first.text) break
      result.content.shift()
    }
    result.attrs = {
      ...result.attrs,
      dir: marks
        ? marks.at(-1) === directionMarks.rtl
          ? 'rtl'
          : 'ltr'
        : direction(result.attrs?.dir),
    }
  } else if (node.type === 'codeBlock') {
    result.attrs = { ...result.attrs, dir: 'ltr' }
  } else if (node.type === 'listItem' || node.type === 'blockquote') {
    result.attrs = { ...result.attrs, dir: direction(result.content?.[0]?.attrs?.dir) }
  }
  if (node.marks) {
    result.marks = node.marks.filter((mark) => mark.type !== 'link' || safeLink(mark.attrs?.href))
  }
  return result
}

const BlockDirection = Extension.create({
  name: 'blockDirection',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'],
        attributes: {
          dir: {
            default: 'auto',
            parseHTML: (element) => direction(element.getAttribute('dir')),
            renderHTML: (attributes) => ({ dir: direction(attributes.dir) }),
          },
        },
      },
    ]
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockDirection'),
        appendTransaction(transactions, _oldState, state) {
          if (!transactions.some((transaction) => transaction.docChanged)) return null
          const tr = state.tr
          // Work backwards so removing pasted markers keeps earlier positions stable.
          const blocks: { pos: number; node: typeof state.doc }[] = []
          state.doc.descendants((node, pos) => {
            if (textBlocks.has(node.type.name) || node.type.name === 'codeBlock')
              blocks.push({ node, pos })
          })
          for (const { node, pos } of blocks.reverse()) {
            const prefix =
              node.type.name === 'codeBlock'
                ? ''
                : (node.textContent.match(leadingMarks)?.[0] ?? '')
            const dir =
              node.type.name === 'codeBlock'
                ? 'ltr'
                : prefix
                  ? prefix.at(-1) === directionMarks.rtl
                    ? 'rtl'
                    : 'ltr'
                  : direction(node.attrs.dir)
            if (node.attrs.dir !== dir) tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir })
            if (prefix) tr.delete(pos + 1, pos + 1 + prefix.length)
          }
          tr.doc.descendants((node, pos) => {
            if (node.type.name !== 'listItem' && node.type.name !== 'blockquote') return
            let first = node.firstChild
            while (first && !first.isTextblock) first = first.firstChild
            const dir = direction(first?.attrs.dir)
            if (node.attrs.dir !== dir) tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir })
          })
          return tr.docChanged ? tr : null
        },
      }),
    ]
  },
})

// Tiptap escapes inline syntax; literal block prefixes also need escaping.
const SafeParagraph = Paragraph.extend({
  renderMarkdown(node, helpers, context) {
    const markdown = this.parent!(node, helpers, context)
    return markdown
      .replace(/^( {0,3})(#{1,6}|>|[-+])(?=\s|$)/gm, '$1\\$2')
      .replace(/^( {0,3}\d+)([.)])(?=\s)/gm, '$1\\$2')
      .replace(/^( {0,3})([-=]+)(?=\s*$)/gm, '$1\\$2')
      .replace(/^( {4,}|\t)/gm, (indent) =>
        indent.startsWith('\t') ? '&#9;' : `&#32;${indent.slice(1)}`,
      )
  },
})

export function richTextExtensions() {
  return [
    StarterKit.configure({
      paragraph: false,
      strike: false,
      underline: false,
      trailingNode: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => Boolean(safeLink(url)),
      },
    }),
    SafeParagraph,
    BlockDirection,
    Markdown.configure({ markedOptions }),
  ]
}

const manager = new MarkdownManager({ extensions: richTextExtensions(), markedOptions })

export function markdownToDocument(markdown: string): JSONContent {
  const document = manager.parse(markdown)
  if (!document.content?.length) document.content = [{ type: 'paragraph' }]
  return normalizeDocument(document)
}

export function documentToMarkdown(document: JSONContent): string {
  function withMarkers(node: JSONContent): JSONContent {
    const result = { ...node, content: node.content?.map(withMarkers) }
    const dir = direction(node.attrs?.dir)
    if (textBlocks.has(node.type ?? '') && dir !== 'auto') {
      result.content = [{ type: 'text', text: directionMarks[dir] }, ...(result.content ?? [])]
    }
    return result
  }
  return manager.serialize(withMarkers(normalizeDocument(document)))
}

/** Render only supported elements/attributes. Vue escapes all text, including raw HTML. */
export function renderRichText(node: JSONContent): VNodeChild {
  const children = node.content?.map(renderRichText) ?? []
  if (node.type === 'text') {
    let result: VNodeChild = node.text ?? ''
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') result = h('strong', {}, [result])
      if (mark.type === 'italic') result = h('em', {}, [result])
      if (mark.type === 'code') result = h('code', { dir: 'ltr' }, [result])
      if (mark.type === 'link') {
        const href = safeLink(mark.attrs?.href)
        if (href) result = h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, [result])
      }
    }
    return result
  }
  const dir = direction(node.attrs?.dir)
  switch (node.type) {
    case 'doc':
      return h('div', {}, children)
    case 'paragraph':
      return h('p', { dir }, children)
    case 'heading':
      return h(`h${Math.min(6, Math.max(1, Number(node.attrs?.level) || 1))}`, { dir }, children)
    case 'bulletList':
      return h('ul', {}, children)
    case 'orderedList':
      return h('ol', { start: Number(node.attrs?.start) || 1 }, children)
    case 'listItem':
      return h('li', { dir }, children)
    case 'blockquote':
      return h('blockquote', { dir }, children)
    case 'codeBlock':
      return h('pre', { dir: 'ltr' }, [h('code', {}, children)])
    case 'hardBreak':
      return h('br')
    case 'horizontalRule':
      return h('hr')
    default:
      return children
  }
}
