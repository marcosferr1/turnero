import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../api'
import type { Doctor, InfoContent, Location } from '../types'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ActiveBadge, Alert, PageHeader, PageLoading, TableScroll } from '../components/page'
import { useConfirm } from '../components/ConfirmProvider'

export default function Configuracion() {
  return (
    <>
      <PageHeader title="Configuración" description="Sedes, textos del bot y profesionales." />
      <Tabs defaultValue="sedes">
        <TabsList className="mb-4 h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="sedes">Sedes</TabsTrigger>
          <TabsTrigger value="info">Información del bot</TabsTrigger>
          <TabsTrigger value="doctores">Profesionales</TabsTrigger>
        </TabsList>
        <TabsContent value="sedes">
          <Sedes />
        </TabsContent>
        <TabsContent value="info">
          <Info />
        </TabsContent>
        <TabsContent value="doctores">
          <Doctores />
        </TabsContent>
      </Tabs>
    </>
  )
}

// ---------- Sedes ----------

function Sedes() {
  const [items, setItems] = useState<Location[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', address: '', notes: '', doctorId: 0, isHomeVisit: false })
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([api.get<Location[]>('/api/locations'), api.get<Doctor[]>('/api/doctors')])
      .then(([locs, ds]) => {
        setItems(locs)
        setDoctors(ds)
        if (ds.length > 0) setForm((f) => ({ ...f, doctorId: f.doctorId || ds[0].id }))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  async function add() {
    setError('')
    try {
      await api.post('/api/locations', form)
      setForm((f) => ({ ...f, name: '', address: '', notes: '', isHomeVisit: false }))
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lugares de atención</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <Alert kind="error">{error}</Alert>}
        {loading ? (
          <PageLoading />
        ) : (
        <>
        <TableScroll>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Profesional</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Indicaciones</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-semibold">{l.name}</TableCell>
                  <TableCell>{l.isHomeVisit ? 'A domicilio' : 'Consultorio'}</TableCell>
                  <TableCell>{l.doctor?.name || '—'}</TableCell>
                  <TableCell>{l.isHomeVisit ? 'Visita al paciente' : l.address}</TableCell>
                  <TableCell className="max-w-44 truncate">{l.notes || '—'}</TableCell>
                  <TableCell>
                    <ActiveBadge active={l.active} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => api.put(`/api/locations/${l.id}`, { ...l, active: !l.active }).then(load)}
                    >
                      {l.active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroll>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2 sm:col-span-2 lg:col-span-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.isHomeVisit}
                onChange={(e) =>
                  setForm({
                    ...form,
                    isHomeVisit: e.target.checked,
                    name: e.target.checked && !form.name ? 'A domicilio' : form.name,
                  })
                }
                className="size-4 rounded border-input"
              />
              Atención a domicilio — la profesional visita al paciente en su casa
            </label>
            {form.isHomeVisit && (
              <p className="text-sm text-muted-foreground">
                La dirección del paciente se pide al reservar el turno (WhatsApp o panel). Acá solo
                se configura la modalidad y la zona donde atiende a domicilio.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Profesional</Label>
            <Select value={String(form.doctorId)} onValueChange={(v) => setForm({ ...form, doctorId: Number(v) })}>
              <SelectTrigger>
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
          </div>
          <div className="grid gap-2">
            <Label>{form.isHomeVisit ? 'Nombre (opcional)' : 'Nombre'}</Label>
            <Input
              value={form.name}
              placeholder={form.isHomeVisit ? 'A domicilio' : 'Consultorio Centro…'}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>{form.isHomeVisit ? 'Zona de cobertura (opcional)' : 'Dirección'}</Label>
            <Input
              value={form.address}
              placeholder={form.isHomeVisit ? 'Ej. Córdoba capital y alrededores' : 'Calle 123, Ciudad'}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>
              {form.isHomeVisit
                ? 'Indicaciones para visitas a domicilio (opcional)'
                : 'Indicaciones del consultorio (opcional)'}
            </Label>
            <Input
              value={form.notes}
              placeholder={
                form.isHomeVisit
                  ? 'Ej. Solo por la mañana, consultas para movilidad reducida…'
                  : 'Piso, timbre, cómo llegar…'
              }
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={add}
          disabled={!form.doctorId || (!form.isHomeVisit && (!form.name || !form.address))}
        >
          <Plus className="size-4" />
          Agregar sede
        </Button>
        </>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Información del bot ----------

function Info() {
  const confirm = useConfirm()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [doctorId, setDoctorId] = useState(0)
  const [items, setItems] = useState<InfoContent[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<InfoContent | null>(null)
  const [form, setForm] = useState({ title: '', body: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api
      .get<Doctor[]>('/api/doctors')
      .then((ds) => {
        setDoctors(ds)
        if (ds.length > 0) setDoctorId(ds[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  const load = useCallback(() => {
    if (!doctorId) return
    setLoading(true)
    api
      .get<InfoContent[]>(`/api/info?doctorId=${doctorId}`)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [doctorId])
  useEffect(load, [load])

  async function save() {
    setError('')
    try {
      if (editing) {
        await api.put(`/api/info/${editing.id}`, { ...editing, ...form })
      } else {
        await api.post('/api/info', { ...form, sortOrder: items.length + 1, doctorId })
      }
      setForm({ title: '', body: '' })
      setEditing(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Textos de la sección "Información"</CardTitle>
        <Select value={String(doctorId)} onValueChange={(v) => { setDoctorId(Number(v)); setEditing(null); setForm({ title: '', body: '' }) }}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {error && <Alert kind="error">{error}</Alert>}
        {loading ? (
          <PageLoading />
        ) : (
        <>
        <TableScroll>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Contenido</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-semibold whitespace-nowrap">{i.title}</TableCell>
                  <TableCell className="whitespace-pre-wrap">{i.body}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(i)
                          setForm({ title: i.title, body: i.body })
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
                            title: 'Eliminar texto',
                            description: '¿Eliminar este texto de información?',
                            confirmLabel: 'Eliminar',
                          })
                          if (ok) api.delete(`/api/info/${i.id}`).then(load)
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
        <div className="mt-5 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Contenido</Label>
            <Textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={save} disabled={!form.title || !form.body}>
            {editing ? 'Guardar cambios' : 'Agregar texto'}
          </Button>
          {editing && (
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null)
                setForm({ title: '', body: '' })
              }}
            >
              Cancelar edición
            </Button>
          )}
        </div>
        </>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Profesionales ----------

function Doctores() {
  const [items, setItems] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api
      .get<Doctor[]>('/api/doctors')
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profesionales</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <Alert kind="error">{error}</Alert>}
        {loading ? (
          <PageLoading />
        ) : (
        <>
        <TableScroll>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Especialidad</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-semibold">{d.name}</TableCell>
                  <TableCell>{d.specialty}</TableCell>
                  <TableCell className="text-sm">
                    {d.whatsappDisplayPhone || d.whatsappPhoneNumberId ? (
                      <div>
                        <div>{d.whatsappDisplayPhone || '—'}</div>
                        {d.whatsappPhoneNumberId && (
                          <div className="text-xs text-muted-foreground">ID: {d.whatsappPhoneNumberId}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sin configurar</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ActiveBadge active={d.active} labels={['Activo', 'Inactivo']} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        api
                          .put(`/api/doctors/${d.id}`, { ...d, active: !d.active })
                          .then(load)
                          .catch((e) => setError(e.message))
                      }
                    >
                      {d.active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroll>
        <p className="mt-4 text-sm text-muted-foreground">
          Para dar de alta una nueva doctora con su cuenta del panel, usá la sección <strong>Usuarios</strong>.
        </p>
        </>
        )}
      </CardContent>
    </Card>
  )
}
