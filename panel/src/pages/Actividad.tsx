import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { api } from '../api'
import { formatShort } from '../lib'
import {
  ACTOR_LABEL,
  EVENT_LABEL,
  type AppointmentEvent,
  type AppointmentEventType,
} from '../types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, Empty, PageHeader, PageLoading } from '../components/page'

function formatWhen(date: string, time: string): string {
  return `${formatShort(date)} ${time} hs`
}

function describeEvent(event: AppointmentEvent): string {
  const patient = event.appointment.patient.fullName || event.appointment.patient.phone
  const when = formatWhen(event.appointment.date, event.appointment.time)
  const meta = event.metadata

  switch (event.type as AppointmentEventType) {
    case 'REPROGRAMADO':
      if (meta?.oldDate && meta.oldTime && meta.newDate && meta.newTime) {
        return `${patient}: ${formatWhen(meta.oldDate, meta.oldTime)} → ${formatWhen(meta.newDate, meta.newTime)}`
      }
      return `${patient} — ${when}`
    default:
      return `${patient} — ${when}`
  }
}

function eventBadgeVariant(type: AppointmentEventType): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (type === 'CONFIRMADO' || type === 'CREADO_PANEL' || type === 'COMPLETADO') return 'default'
  if (type === 'RECHAZADO' || type === 'CANCELADO_PACIENTE' || type === 'CANCELADO_DOCTOR') return 'destructive'
  if (type === 'SOLICITUD_CREADA') return 'secondary'
  return 'outline'
}

function formatEventTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Actividad() {
  const [items, setItems] = useState<AppointmentEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    api
      .get<AppointmentEvent[]>('/api/appointments/events?limit=80')
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  return (
    <>
      <PageHeader
        title="Actividad"
        description="Movimientos recientes de turnos: solicitudes, confirmaciones, cancelaciones y recordatorios."
      />
      {error && <Alert kind="error">{error}</Alert>}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <PageLoading />
          ) : items.length === 0 ? (
            <Empty>Todavía no hay movimientos registrados.</Empty>
          ) : (
            <ul className="divide-y">
              {items.map((event) => (
                <li key={event.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bell className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant={eventBadgeVariant(event.type)}>{EVENT_LABEL[event.type]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {ACTOR_LABEL[event.actor]}
                        {event.user?.fullName ? ` · ${event.user.fullName}` : ''}
                      </span>
                    </div>
                    <p className="text-sm">{describeEvent(event)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.appointment.location.name} · {formatEventTime(event.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}
