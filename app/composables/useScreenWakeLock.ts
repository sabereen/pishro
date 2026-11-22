import type { WatchSource } from 'vue'

export function useScreenWakeLock(active: WatchSource<boolean>) {
  const visible = ref(false)

  function updateVisibility() {
    visible.value = document.visibilityState === 'visible'
  }

  onMounted(() => {
    if (!navigator.wakeLock) return
    document.addEventListener('visibilitychange', updateVisibility)
    updateVisibility()
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', updateVisibility)
  })

  watch(
    [active, visible],
    async ([shouldKeepAwake, isVisible], _, onCleanup) => {
      if (!shouldKeepAwake || !isVisible) return

      let lock: WakeLockSentinel | undefined
      let cancelled = false
      onCleanup(() => {
        cancelled = true
        if (lock) void lock.release().catch(() => {})
      })

      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) await lock.release()
      } catch {
        // A browser or device may deny the request while voting is still available.
      }
    },
    { flush: 'sync' },
  )
}
