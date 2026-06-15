import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { formatShort } from '../lib'
import type { Appointment } from '../types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, Empty, PageHeader, TableScroll } from '../components/page'

export default function Pendientes() {
  const { user } = useAuth()
  const isDoctor = user?.role === 'DOCTOR'
  const [items, setItems] = useState<Appointment[]>([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(() => {
    api.get<Appointment[]>('/api/appointments/pending').then(setItems).catch((e) => setError(e.message))
  }, [])

  useEffect(load, [load])

  async function act(id: number, action: 'approve' | 'reject') {
    setBusyId(id)
    setError('')
    try {
      await api.post(`/api/appointments/${id}/${action}`)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Solicitudes pendientes"
        description="Turnos solicitados por WhatsApp que esperan confirmación."
      />
      {error && <Alert kind="error">{error}</Alert>}
      <Card>
        <CardContent className="pt-6">
          {items.length === 0 ? (
            <Empty>No hay solicitudes pendientes.</Empty>
          ) : (
            <>
              {/* Vista mobile: tarjetas */}
              <div className="flex flex-col gap-3 md:hidden">
                {items.map((a) => (
                  <div key={a.id} className="rounded-xl border bg-card p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{a.patient.fullName || 'Sin nombre'}</p>
                        <p className="text-xs text-muted-foreground">{a.patient.phone}</p>
                      </div>
                      <div className="shrink-0 text-right text-sm">
                        <p className="font-bold text-primary">{a.time} hs</p>
                        <p className="text-muted-foreground">{formatShort(a.date)}</p>
                      </div>
                    </div>
                    <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                      <dt className="text-muted-foreground">DNI</dt>
                      <dd>{a.patient.dni || '—'}</dd>
                      <dt className="text-muted-foreground">Obra social</dt>
                      <dd>{a.patient.insurance || '—'}</dd>
                      <dt className="text-muted-foreground">Sede</dt>
                      <dd>{a.location.name}</dd>
                      {!isDoctor && (
                        <>
                          <dt className="text-muted-foreground">Profesional</dt>
                          <dd>{a.doctor.name}</dd>
                        </>
                      )}
                      {a.motivo && (
                        <>
                          <dt className="col-span-2 text-muted-foreground">Motivo</dt>
                          <dd className="col-span-2">{a.motivo}</dd>
                        </>
                      )}
                    </dl>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        size="sm"
                        disabled={busyId === a.id}
                        onClick={() => act(a.id, 'approve')}
                      >
                        <Check className="size-4" />
                        Confirmar
                      </Button>
                      <Button
                        className="flex-1"
                        size="sm"
                        variant="outline"
                        disabled={busyId === a.id}
                        onClick={() => act(a.id, 'reject')}
                      >
                        <X className="size-4" />
                        Rechazar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Vista desktop: tabla */}
              <div className="hidden md:block">
                <TableScroll>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>DNI</TableHead>
                        <TableHead>Obra social</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Sede</TableHead>
                        {!isDoctor && <TableHead>Profesional</TableHead>}
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{formatShort(a.date)}</TableCell>
                          <TableCell className="font-semibold">{a.time} hs</TableCell>
                          <TableCell>
                            <div>{a.patient.fullName || '—'}</div>
                            <div className="text-xs text-muted-foreground">{a.patient.phone}</div>
                          </TableCell>
                          <TableCell>{a.patient.dni || '—'}</TableCell>
                          <TableCell>{a.patient.insurance || '—'}</TableCell>
                          <TableCell className="max-w-44 truncate">{a.motivo || '—'}</TableCell>
                          <TableCell>{a.location.name}</TableCell>
                          {!isDoctor && <TableCell>{a.doctor.name}</TableCell>}
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" disabled={busyId === a.id} onClick={() => act(a.id, 'approve')}>
                                <Check className="size-4" />
                                Confirmar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={busyId === a.id}
                                onClick={() => act(a.id, 'reject')}
                              >
                                <X className="size-4" />
                                Rechazar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableScroll>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
