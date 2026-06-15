import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABEL, type AppointmentStatus } from '../types'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {actions}
        </div>
      )}
    </div>
  )
}

export function Alert({ kind, children }: { kind: 'error' | 'ok'; children: ReactNode }) {
  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-2.5 text-sm font-medium ${
        kind === 'error'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-primary/30 bg-primary/10 text-primary'
      }`}
    >
      {children}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{children}</div>
}

/** Contenedor con scroll horizontal temático para tablas en pantallas chicas. */
export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="min-w-[640px]">{children}</div>
    </div>
  )
}

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  PENDIENTE:
    'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 border-transparent',
  CONFIRMADO:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border-transparent',
  RECHAZADO: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-transparent',
  CANCELADO_PACIENTE:
    'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-transparent',
  CANCELADO_DOCTOR:
    'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-transparent',
  COMPLETADO: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-400 border-transparent',
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</Badge>
}

export function ActiveBadge({ active, labels }: { active: boolean; labels?: [string, string] }) {
  const [on, off] = labels ?? ['Activa', 'Inactiva']
  return (
    <Badge
      className={
        active
          ? 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400'
          : 'border-transparent bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
      }
    >
      {active ? on : off}
    </Badge>
  )
}
