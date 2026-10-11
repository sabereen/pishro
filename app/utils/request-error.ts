export function requestError(error: unknown) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = error.data
    if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
      return data.message
    }
  }
  return 'ارتباط برقرار نشد. لطفاً دوباره تلاش کنید.'
}
