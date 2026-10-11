import type { Ref } from 'vue'
import type { Task } from '#shared/models'
import type { TaskStatus } from '#shared/scrum'
import { statusLabels, taskStatuses } from '#shared/scrum'

type DragState = {
  task: Task
  source: TaskStatus
  over: TaskStatus | null
  pointerId: number | null
  handle: HTMLElement
  active: boolean
  settling: boolean
  startX: number
  startY: number
  x: number
  y: number
  offsetX: number
  offsetY: number
  width: number
}

export function useKanbanDrag(options: {
  board: Ref<HTMLElement | null>
  blocked: Ref<boolean>
  move: (id: string, status: TaskStatus) => Promise<boolean>
}) {
  const drag = ref<DragState | null>(null)
  const announcement = ref('')
  let frame = 0
  let lastFrame = 0
  let landingTimer: ReturnType<typeof setTimeout> | undefined

  function cardElement(id: string) {
    return Array.from(options.board.value?.querySelectorAll<HTMLElement>('[data-task-id]') ?? [])
      .find((element) => element.dataset.taskId === id && !element.classList.contains('kanban-card-leave-active'))
  }

  function columnElement(status: TaskStatus) {
    return options.board.value?.querySelector<HTMLElement>(`[data-status="${status}"]`)
  }

  function cleanup() {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    lastFrame = 0
    clearTimeout(landingTimer)
    landingTimer = undefined
    window.removeEventListener('pointermove', pointerMove)
    window.removeEventListener('pointerup', pointerUp)
    window.removeEventListener('pointercancel', pointerCancel)
    window.removeEventListener('keydown', keyboardMove)
    window.removeEventListener('blur', windowBlur)
    const state = drag.value
    drag.value = null
    state?.handle.removeEventListener('lostpointercapture', pointerCancel)
    if (state?.pointerId !== null && state?.pointerId !== undefined && state.handle.hasPointerCapture(state.pointerId)) {
      state.handle.releasePointerCapture(state.pointerId)
    }
  }

  function begin(task: Task, handle: HTMLElement, pointerId: number | null, x: number, y: number) {
    if (options.blocked.value || drag.value) return
    const rect = cardElement(task.id)?.getBoundingClientRect()
    if (!rect) return
    drag.value = {
      task, source: task.status, over: task.status, handle, pointerId,
      active: pointerId === null, settling: false, startX: x, startY: y, x, y,
      offsetX: x - rect.left, offsetY: y - rect.top, width: rect.width,
    }
    handle.focus({ preventScroll: true })
    window.addEventListener('pointermove', pointerMove, { passive: false })
    window.addEventListener('pointerup', pointerUp)
    window.addEventListener('pointercancel', pointerCancel)
    window.addEventListener('keydown', keyboardMove)
    window.addEventListener('blur', windowBlur)
    if (pointerId !== null) {
      handle.addEventListener('lostpointercapture', pointerCancel)
      handle.setPointerCapture(pointerId)
    }
    else announcement.value = `${task.title} انتخاب شد. با کلیدهای جهت ستون را انتخاب کنید؛ برای رها کردن فاصله یا اینتر و برای لغو Escape را بزنید.`
  }

  function grab(event: PointerEvent, task: Task) {
    if (!event.isPrimary || event.button !== 0 || options.blocked.value || drag.value) return
    event.preventDefault()
    begin(task, event.currentTarget as HTMLElement, event.pointerId, event.clientX, event.clientY)
  }

  function handleKey(event: KeyboardEvent, task: Task) {
    if (event.repeat || ![' ', 'Enter'].includes(event.key) || drag.value || options.blocked.value) return
    event.preventDefault()
    event.stopPropagation()
    const rect = cardElement(task.id)?.getBoundingClientRect()
    if (rect) begin(task, event.currentTarget as HTMLElement, null, rect.left + rect.width / 2, rect.top + 24)
  }

  function updateTarget() {
    const state = drag.value
    if (!state || state.settling || state.pointerId === null) return
    const column = document.elementFromPoint(state.x, state.y)?.closest<HTMLElement>('[data-status]')
    const status = column?.dataset.status as TaskStatus | undefined
    const next = column && options.board.value?.contains(column) && status && taskStatuses.includes(status) ? status : null
    if (state.over !== next) {
      state.over = next
      announcement.value = next ? `ستون ${statusLabels[next]}؛ برای انتقال رها کنید.` : 'برای انتقال، کارت را روی یکی از ستون‌ها ببرید.'
    }
  }

  function autoScroll(time: number) {
    const state = drag.value
    const board = options.board.value
    if (!state?.active || state.settling || state.pointerId === null || !board) return
    const elapsed = lastFrame ? Math.min(time - lastFrame, 32) : 16
    lastFrame = time
    const rect = board.getBoundingClientRect()
    const left = Math.max(0, rect.left)
    const right = Math.min(window.innerWidth, rect.right)
    const edge = Math.min(56, (right - left) / 4)
    if (edge > 0 && state.y >= Math.max(rect.top, 0) && state.y <= Math.min(rect.bottom, window.innerHeight) && state.x >= left - 12 && state.x <= right + 12) {
      const speed = state.x < left + edge ? -Math.min(1, (left + edge - state.x) / edge)
        : state.x > right - edge ? Math.min(1, (state.x - right + edge) / edge) : 0
      board.scrollBy({ left: speed * elapsed * .7, behavior: 'instant' })
    }
    if (state.x >= left && state.x <= right && state.y >= 0 && state.y <= window.innerHeight) {
      const speed = state.y < 56 ? -(56 - state.y) / 56
        : state.y > window.innerHeight - 56 ? (state.y - window.innerHeight + 56) / 56 : 0
      window.scrollBy({ top: speed * elapsed * .6, behavior: 'instant' })
    }
    updateTarget()
    frame = requestAnimationFrame(autoScroll)
  }

  function pointerMove(event: PointerEvent) {
    const state = drag.value
    if (!state || state.settling || state.pointerId !== event.pointerId) return
    event.preventDefault()
    state.x = event.clientX
    state.y = event.clientY
    if (!state.active && Math.hypot(state.x - state.startX, state.y - state.startY) >= 6) {
      state.active = true
      announcement.value = `${state.task.title} انتخاب شد؛ روی ستون مقصد رها کنید.`
      frame = requestAnimationFrame(autoScroll)
    }
    if (state.active) updateTarget()
  }

  async function finish(cancelled = false, restoreFocus = true) {
    const state = drag.value
    if (!state || state.settling) return
    if (!state.active) { cleanup(); return }
    state.settling = true
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    const target = cancelled ? null : state.over
    if (target && target !== state.source) {
      // The board applies the new status immediately, then persists or rolls it back.
      void options.move(state.task.id, target)
    } else {
      announcement.value = 'جابه‌جایی لغو شد؛ کارت در ستون قبلی ماند.'
    }
    await nextTick()
    if (drag.value !== state) return
    const rect = cardElement(state.task.id)?.getBoundingClientRect()
    if (rect) { state.x = rect.left + state.offsetX; state.y = rect.top + state.offsetY }
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180
    landingTimer = setTimeout(() => {
      cleanup()
      if (restoreFocus) cardElement(state.task.id)?.querySelector<HTMLElement>('[data-drag-handle]')?.focus({ preventScroll: true })
    }, duration)
  }

  function pointerUp(event: PointerEvent) {
    const state = drag.value
    if (!state || state.pointerId !== event.pointerId || state.settling) return
    state.x = event.clientX
    state.y = event.clientY
    updateTarget()
    void finish()
  }

  function pointerCancel() { void finish(true) }
  function windowBlur() { void finish(true, false) }

  function keyboardMove(event: KeyboardEvent) {
    const state = drag.value
    if (!state || state.settling) return
    if (event.key === 'Escape') { event.preventDefault(); void finish(true); return }
    if (event.key === 'Tab') { void finish(true, false); return }
    if (state.pointerId !== null) return
    if ([' ', 'Enter'].includes(event.key)) {
      event.preventDefault()
      if (!event.repeat) void finish()
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const current = taskStatuses.indexOf(state.over ?? state.source)
    const rtl = options.board.value && getComputedStyle(options.board.value).direction === 'rtl'
    const forward = event.key === 'ArrowDown' || event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? taskStatuses.length - 1
      : Math.max(0, Math.min(taskStatuses.length - 1, current + (forward ? 1 : -1)))
    const status = taskStatuses[index]
    if (!status) return
    state.over = status
    const column = columnElement(status)
    column?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' })
    const rect = column?.getBoundingClientRect()
    if (rect) { state.x = rect.left + 12 + state.offsetX; state.y = rect.top + 72 + state.offsetY }
    announcement.value = `ستون ${statusLabels[status]}؛ برای انتقال فاصله یا اینتر را بزنید.`
  }

  onBeforeUnmount(cleanup)
  return { drag, announcement, grab, handleKey, cancel: cleanup }
}
