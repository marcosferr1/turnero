import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { addDays, formatLong, formatShort, mondayOf, todayStr } from '../lib'
import SlotPicker from '../components/SlotPicker'
import { type Appointment, type Doctor, type Location } from '../types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, PageHeader, PageLoading, StatusBadge } from '../components/page'
import { useConfirm } from '../components/ConfirmProvider'

const CARD_STATUS_CLASS: Record<string, string> = {
  PENDIENTE: 'border-l-amber-500 bg-amber-50 dark:bg-amber-500/10',
  CONFIRMADO: 'border-l-primary',
  COMPLETADO: 'border-l-sky-500 opacity-70',
}

export default function Agenda() {
  const { user } = useAuth()
  const isDoctor = user?.role === 'DOCTOR'
  const [monday, setMonday] = useState(() => mondayOf(todayStr()))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState('')

  const weekEnd = addDays(monday, 5)
  const days = Array.from({ length: 6 }, (_, i) => addDays(monday, i))

  const load = useCallback(() => {
    setLoading(true)
    api
      .get<Appointment[]>(`/api/appointments?from=${monday}&to=${weekEnd}`)
      .then(setAppointments)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [monday, weekEnd])

  useEffect(load, [load])
  useEffect(() => {
    if (!isDoctor) api.get<Doctor[]>('/api/doctors').then(setDoctors).catch(() => {})
    api.get<Location[]>('/api/locations').then(setLocations).catch(() => {})
  }, [isDoctor])

  const visible = appointments.filter((a) =>
    ['PENDIENTE', 'CONFIRMADO', 'COMPLETADO'].includes(a.status),
  )

  return (
    <>
      <PageHeader
        title="Agenda semanal"
        description={`Semana del ${formatLong(monday)} al ${formatLong(weekEnd)}`}
        actions={
          <>
            <div className="flex w-full items-center gap-1 sm:w-auto">
              <Button variant="outline" size="icon-sm" onClick={() => setMonday(addDays(monday, -7))}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setMonday(mondayOf(todayStr()))}>
                Hoy
              </Button>
              <Button variant="outline" size="icon-sm" onClick={() => setMonday(addDays(monday, 7))}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button className="w-full sm:w-auto" onClick={() => setShowNew(true)}>
              <Plus className="size-4" />
              Nuevo turno
            </Button>
          </>
        }
      />
      {error && <Alert kind="error">{error}</Alert>}

      {loading ? (
        <PageLoading />
      ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {days.map((date) => {
          const isToday = date === todayStr()
          return (
            <div
              key={date}
              className={`min-h-44 overflow-hidden rounded-xl border bg-card ${
                isToday ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border'
              }`}
            >
              <header
                className={`border-b px-2 py-2 text-center text-xs font-semibold ${
                  isToday ? 'bg-primary/10 text-primary' : 'bg-muted/60 text-muted-foreground'
                }`}
              >
                {formatShort(date)}
              </header>
              <div className="p-1.5">
                {visible
                  .filter((a) => a.date === date)
                  .map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className={`mb-1.5 w-full rounded-lg border border-l-4 bg-card px-2 py-1.5 text-left text-xs transition-shadow hover:shadow-md ${
                        CARD_STATUS_CLASS[a.status] || 'border-l-muted-foreground'
                      }`}
                    >
                      <div className="text-[13px] font-bold">{a.time} hs</div>
                      <div className="truncate">{a.patient.fullName || a.patient.phone}</div>
                      <div className="truncate text-muted-foreground">
                        {a.location.isVirtualVisit
                          ? 'Virtual'
                          : a.location.isHomeVisit
                            ? 'A domicilio'
                            : a.location.name}
                      </div>
                      {!isDoctor && <div className="truncate text-muted-foreground">{a.doctor.name}</div>}
                    </button>
                  ))}
              </div>
            </div>
          )
        })}
      </div>
      )}

      {selected && (
        <DetailModal
          appointment={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null)
            load()
          }}
        />
      )}
      {showNew && (
        <NewAppointmentModal
          doctors={doctors}
          locations={locations}
          ownDoctorId={isDoctor ? user!.doctorId || 0 : 0}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false)
            load()
          }}
        />
      )}
    </>
  )
}

// ---------- Detalle de turno ----------

function DetailModal({
  appointment: a,
  onClose,
  onChanged,
}: {
  appointment: Appointment
  onClose: () => void
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const [mode, setMode] = useState<'view' | 'reschedule'>('view')
  const [newDate, setNewDate] = useState(a.date)
  const [newTime, setNewTime] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setBusy(false)
    }
  }

  const rows: [string, string][] = [
    ['Paciente', a.patient.fullName || '—'],
    ['Teléfono', a.patient.phone],
    ['Email', a.patient.email || '—'],
    ['DNI', a.patient.dni || '—'],
    ['Obra social', a.patient.insurance || '—'],
    ['Motivo', a.motivo || '—'],
    ['Profesional', a.doctor.name],
    [
      a.location.isVirtualVisit || a.location.isHomeVisit ? 'Modalidad' : 'Sede',
      a.location.isVirtualVisit
        ? 'Consulta virtual (Meet por Gmail)'
        : a.location.isHomeVisit
          ? 'Visita a domicilio'
          : `${a.location.name} — ${a.location.address}`,
    ],
    ...(a.location.isHomeVisit
      ? ([['Dirección del paciente', a.patientAddress || '—']] as [string, string][])
      : []),
    ...(a.location.isVirtualVisit && !a.patient.email
      ? ([['Aviso', 'Sin email cargado — necesario para enviar el Meet']] as [string, string][])
      : []),
    ['Origen', a.createdVia === 'bot' ? 'WhatsApp' : 'Panel'],
  ]

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Turno — {formatShort(a.date)} {a.time} hs
            <StatusBadge status={a.status} />
          </DialogTitle>
        </DialogHeader>
        {error && <Alert kind="error">{error}</Alert>}

        {mode === 'view' && (
          <>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[120px_1fr]">
              {rows.map(([dt, dd]) => (
                <div key={dt} className="contents">
                  <dt className="text-muted-foreground">{dt}</dt>
                  <dd className="font-medium">{dd}</dd>
                </div>
              ))}
            </dl>
            <DialogFooter className="flex-wrap">
              {a.status === 'PENDIENTE' && (
                <Button disabled={busy} onClick={() => run(() => api.post(`/api/appointments/${a.id}/approve`))}>
                  Confirmar
                </Button>
              )}
              {a.status === 'CONFIRMADO' && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => run(() => api.post(`/api/appointments/${a.id}/complete`))}
                >
                  Marcar atendido
                </Button>
              )}
              {['PENDIENTE', 'CONFIRMADO'].includes(a.status) && (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => setMode('reschedule')}>
                    Reprogramar
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Cancelar turno',
                        description:
                          '¿Cancelar este turno? Se notificará al paciente por WhatsApp.',
                        confirmLabel: 'Sí, cancelar',
                      })
                      if (ok) run(() => api.post(`/api/appointments/${a.id}/cancel`))
                    }}
                  >
                    Cancelar turno
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}

        {mode === 'reschedule' && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="newDate">Nueva fecha</Label>
              <Input
                id="newDate"
                type="date"
                value={newDate}
                min={todayStr()}
                onChange={(e) => {
                  setNewDate(e.target.value)
                  setNewTime('')
                }}
              />
            </div>
            <SlotPicker
              doctorId={a.doctorId}
              locationId={a.locationId}
              date={newDate}
              value={newTime}
              onChange={setNewTime}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode('view')}>
                Volver
              </Button>
              <Button
                disabled={busy || !newTime}
                onClick={() =>
                  run(() =>
                    api.post(`/api/appointments/${a.id}/reschedule`, { date: newDate, time: newTime }),
                  )
                }
              >
                Reprogramar y notificar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------- Nuevo turno manual ----------

function NewAppointmentModal({
  doctors,
  locations,
  ownDoctorId,
  onClose,
  onCreated,
}: {
  doctors: Doctor[]
  locations: Location[]
  ownDoctorId: number
  onClose: () => void
  onCreated: () => void
}) {
  const activeDoctors = doctors.filter((d) => d.active)
  const initialDoctorId = ownDoctorId || activeDoctors[0]?.id || 0
  const [form, setForm] = useState({
    doctorId: initialDoctorId,
    locationId: locations.find((l) => l.active && l.doctorId === initialDoctorId)?.id || 0,
    date: todayStr(),
    time: '',
    phone: '',
    fullName: '',
    dni: '',
    insurance: '',
    motivo: '',
    patientAddress: '',
    email: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const doctorLocations = locations.filter((l) => l.active && l.doctorId === form.doctorId)
  const selectedLocation = doctorLocations.find((l) => l.id === form.locationId)
  const isHomeVisit = Boolean(selectedLocation?.isHomeVisit)
  const isVirtualVisit = Boolean(selectedLocation?.isVirtualVisit)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    const resetsTime = key === 'date' || key === 'doctorId' || key === 'locationId'
    setForm((f) => {
      const next = { ...f, [key]: value, ...(resetsTime ? { time: '' } : {}) }
      if (key === 'doctorId') {
        next.locationId =
          locations.find((l) => l.active && l.doctorId === (value as number))?.id || 0
        next.patientAddress = ''
      }
      if (key === 'locationId') {
        next.patientAddress = ''
        next.email = ''
      }
      return next
    })
  }

  async function submit() {
    setBusy(true)
    setError('')
    try {
      await api.post('/api/appointments', form)
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Nuevo turno (carga manual)</DialogTitle>
          <DialogDescription>Se crea directamente confirmado.</DialogDescription>
        </DialogHeader>
        {error && <Alert kind="error">{error}</Alert>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {!ownDoctorId && (
            <div className="grid gap-2">
              <Label>Profesional</Label>
              <Select value={String(form.doctorId)} onValueChange={(v) => set('doctorId', Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeDoctors.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Sede</Label>
            <Select value={String(form.locationId)} onValueChange={(v) => set('locationId', Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {doctorLocations.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name}
                    {l.isVirtualVisit ? ' (virtual)' : l.isHomeVisit ? ' (domicilio)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Fecha</Label>
            <Input type="date" value={form.date} min={todayStr()} onChange={(e) => set('date', e.target.value)} />
          </div>
        </div>

        <SlotPicker
          doctorId={form.doctorId}
          locationId={form.locationId}
          date={form.date}
          value={form.time}
          onChange={(t) => set('time', t)}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Teléfono (WhatsApp)</Label>
            <Input value={form.phone} placeholder="549261…" onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Nombre y apellido</Label>
            <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>DNI</Label>
            <Input value={form.dni} onChange={(e) => set('dni', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Obra social</Label>
            <Input value={form.insurance} onChange={(e) => set('insurance', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Email {isVirtualVisit ? '(obligatorio)' : '(opcional)'}</Label>
            <Input
              type="email"
              value={form.email}
              placeholder="nombre@gmail.com"
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
          <div className="col-span-2 grid gap-2">
            <Label>Motivo</Label>
            <Input value={form.motivo} onChange={(e) => set('motivo', e.target.value)} />
          </div>
          {isHomeVisit && (
            <div className="col-span-2 grid gap-2">
              <Label>Dirección del paciente</Label>
              <Input
                value={form.patientAddress}
                placeholder="Calle, número, piso/depto, localidad…"
                onChange={(e) => set('patientAddress', e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={
              busy ||
              !form.time ||
              !form.phone ||
              !form.fullName ||
              (isHomeVisit && !form.patientAddress.trim()) ||
              (isVirtualVisit && !form.email.trim())
            }
            onClick={submit}
          >
            Crear turno confirmado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
