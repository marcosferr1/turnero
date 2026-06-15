import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { formatLong, todayStr } from '../lib'
import { WEEKDAYS, type Block, type Doctor, type Location, type Schedule } from '../types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, Empty, PageHeader, PageLoading, TableScroll } from '../components/page'
import { useConfirm } from '../components/ConfirmProvider'

export default function Disponibilidad() {
  const confirm = useConfirm()
  const { user } = useAuth()
  const isDoctor = user?.role === 'DOCTOR'
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [allLocations, setAllLocations] = useState<Location[]>([])
  const [doctorId, setDoctorId] = useState(isDoctor ? user!.doctorId || 0 : 0)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [schedForm, setSchedForm] = useState({ locationId: 0, weekday: 1, startTime: '09:00', endTime: '13:00', slotMinutes: 30 })
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [blockForm, setBlockForm] = useState({ dateFrom: todayStr(), dateTo: todayStr(), reason: '' })

  useEffect(() => {
    if (!isDoctor) {
      api.get<Doctor[]>('/api/doctors').then((ds) => {
        setDoctors(ds)
        if (ds.length > 0) setDoctorId((id) => id || ds[0].id)
      })
    }
    api.get<Location[]>('/api/locations').then(setAllLocations)
  }, [isDoctor])

  const locations = allLocations.filter((l) => l.doctorId === doctorId && l.active)

  useEffect(() => {
    setSchedForm((f) => {
      if (locations.some((l) => l.id === f.locationId)) return f
      return { ...f, locationId: locations[0]?.id || 0 }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, allLocations])

  const load = useCallback(() => {
    if (!doctorId) {
      setSchedules([])
      setBlocks([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      api.get<Schedule[]>(`/api/schedules?doctorId=${doctorId}`),
      api.get<Block[]>(`/api/blocks?doctorId=${doctorId}`),
    ])
      .then(([s, b]) => {
        setSchedules(s)
        setBlocks(b)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false))
  }, [doctorId])

  useEffect(load, [load])

  function resetSchedForm() {
    setEditingSchedule(null)
    setSchedForm({
      locationId: locations[0]?.id || 0,
      weekday: 1,
      startTime: '09:00',
      endTime: '13:00',
      slotMinutes: 30,
    })
  }

  async function saveSchedule() {
    setError('')
    try {
      if (editingSchedule) {
        await api.put(`/api/schedules/${editingSchedule.id}`, { ...schedForm, doctorId })
      } else {
        await api.post('/api/schedules', { ...schedForm, doctorId })
      }
      resetSchedForm()
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  async function addBlock() {
    setError('')
    try {
      await api.post('/api/blocks', { ...blockForm, doctorId })
      setBlockForm({ dateFrom: todayStr(), dateTo: todayStr(), reason: '' })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <>
      <PageHeader
        title="Disponibilidad"
        description="Horarios de atención semanales y bloqueos puntuales."
        actions={
          !isDoctor && doctors.length > 0 ? (
            <Select
              value={String(doctorId)}
              onValueChange={(v) => {
                setDoctorId(Number(v))
                setEditingSchedule(null)
                setSchedForm({
                  locationId: 0,
                  weekday: 1,
                  startTime: '09:00',
                  endTime: '13:00',
                  slotMinutes: 30,
                })
              }}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />
      {error && <Alert kind="error">{error}</Alert>}

      {loading ? (
        <PageLoading />
      ) : (
      <>
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Horarios semanales</CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <Empty>Sin horarios cargados.</Empty>
          ) : (
            <TableScroll>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Día</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Horario</TableHead>
                    <TableHead>Duración del turno</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-semibold">{WEEKDAYS[s.weekday]}</TableCell>
                      <TableCell>{s.location.name}</TableCell>
                      <TableCell>
                        {s.startTime} – {s.endTime}
                      </TableCell>
                      <TableCell>{s.slotMinutes} min</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon-sm"
                            variant="outline"
                            onClick={() => {
                              setEditingSchedule(s)
                              setSchedForm({
                                locationId: s.locationId,
                                weekday: s.weekday,
                                startTime: s.startTime,
                                endTime: s.endTime,
                                slotMinutes: s.slotMinutes,
                              })
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Eliminar horario',
                                description: '¿Eliminar este horario de atención?',
                                confirmLabel: 'Eliminar',
                              })
                              if (ok) {
                                if (editingSchedule?.id === s.id) resetSchedForm()
                                api.delete(`/api/schedules/${s.id}`).then(load)
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {editingSchedule && (
              <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-5">
                Editando horario de {WEEKDAYS[editingSchedule.weekday]} — {editingSchedule.location.name}
              </p>
            )}
            <div className="grid gap-2">
              <Label>Día</Label>
              <Select
                value={String(schedForm.weekday)}
                onValueChange={(v) => setSchedForm({ ...schedForm, weekday: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {WEEKDAYS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Sede</Label>
              <Select
                value={String(schedForm.locationId)}
                onValueChange={(v) => setSchedForm({ ...schedForm, locationId: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin sedes" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name}
                      {l.isHomeVisit ? ' (domicilio)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Desde</Label>
              <Input
                type="time"
                value={schedForm.startTime}
                onChange={(e) => setSchedForm({ ...schedForm, startTime: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Hasta</Label>
              <Input
                type="time"
                value={schedForm.endTime}
                onChange={(e) => setSchedForm({ ...schedForm, endTime: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Minutos por turno</Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={schedForm.slotMinutes}
                onChange={(e) => setSchedForm({ ...schedForm, slotMinutes: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={saveSchedule} disabled={!schedForm.locationId}>
              {editingSchedule ? 'Guardar cambios' : (
                <>
                  <Plus className="size-4" />
                  Agregar horario
                </>
              )}
            </Button>
            {editingSchedule && (
              <Button variant="outline" onClick={resetSchedForm}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bloqueos (vacaciones, feriados, ausencias)</CardTitle>
        </CardHeader>
        <CardContent>
          {blocks.length === 0 ? (
            <Empty>Sin bloqueos cargados.</Empty>
          ) : (
            <TableScroll>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Desde</TableHead>
                    <TableHead>Hasta</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blocks.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{formatLong(b.dateFrom)}</TableCell>
                      <TableCell>{formatLong(b.dateTo)}</TableCell>
                      <TableCell>{b.reason || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Eliminar bloqueo',
                              description: '¿Eliminar este bloqueo de agenda?',
                              confirmLabel: 'Eliminar',
                            })
                            if (ok) api.delete(`/api/blocks/${b.id}`).then(load)
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Desde</Label>
              <Input
                type="date"
                value={blockForm.dateFrom}
                onChange={(e) => setBlockForm({ ...blockForm, dateFrom: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={blockForm.dateTo}
                onChange={(e) => setBlockForm({ ...blockForm, dateTo: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Motivo</Label>
              <Input
                value={blockForm.reason}
                placeholder="Vacaciones…"
                onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
              />
            </div>
          </div>
          <Button className="mt-4" onClick={addBlock}>
            <Plus className="size-4" />
            Agregar bloqueo
          </Button>
        </CardContent>
      </Card>
      </>
      )}
    </>
  )
}
