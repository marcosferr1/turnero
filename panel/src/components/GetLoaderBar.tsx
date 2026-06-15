import { useSyncExternalStore } from 'react'
import { getPendingGetCount, subscribeGetLoading } from '../lib/getLoading'

export function GetLoaderBar() {
  const active = useSyncExternalStore(subscribeGetLoading, () => getPendingGetCount() > 0, () => false)
  if (!active) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-primary/15"
      role="progressbar"
      aria-label="Cargando"
    >
      <div className="loader-bar h-full w-1/3 bg-primary" />
    </div>
  )
}
