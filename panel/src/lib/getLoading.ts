let pendingGets = 0
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((l) => l())
}

export function trackGet<T>(promise: Promise<T>): Promise<T> {
  pendingGets++
  notify()
  return promise.finally(() => {
    pendingGets--
    notify()
  })
}

export function getPendingGetCount(): number {
  return pendingGets
}

export function subscribeGetLoading(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
