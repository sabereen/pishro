export function useToasts() {
  const toasts = useState<{ id: number; message: string; tone: 'success' | 'error' }[]>('toasts', () => [])
  function toast(message: string, tone: 'success' | 'error' = 'success') {
    const id = Date.now() + Math.random()
    toasts.value.push({ id, message, tone })
    setTimeout(() => { toasts.value = toasts.value.filter((item) => item.id !== id) }, 6000)
  }
  return { toasts, toast }
}

export function useAction() {
  const busy = ref(false)
  const error = ref('')
  const { toast } = useToasts()
  async function run(action: () => Promise<unknown>, success?: string) {
    if (busy.value) return false
    busy.value = true
    error.value = ''
    try {
      await action()
      if (success) toast(success)
      return true
    } catch (cause) {
      error.value = requestError(cause)
      toast(error.value, 'error')
      return false
    } finally {
      busy.value = false
    }
  }
  return { busy, error, run }
}
