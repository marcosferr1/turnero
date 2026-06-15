import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import type { Doctor, InfoContent, Location } from '../types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ActiveBadge, Alert, Empty, InlineLoader, PageHeader, TableScroll } from '../components/page'
import { useConfirm } from '../components/ConfirmProvider'

export default function MiConsultorio() {
  return (
    <>
      <PageHeader
        title="Mi consultorio"
        description="Tus datos profesionales, textos del bot, sedes y contraseña."
      />
      <Perfil />
      <WhatsApp />
      <InfoBot />
      <MisSedes />
      <CambioPassword />
    </>
  )
}

// ---------- Datos profesionales ----------

function Perfil() {
  const { user } = useAuth()
  const [form, setForm] = useState({ name: '', specialty: '' })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api
      .get<Doctor[]>('/api/doctors')
      .then((ds) => {
        const me = ds.find((d) => d.id === user?.doctorId)
        if (me) setForm({ name: me.name, specialty: me.specialty })
      })
      .finally(() => setLoading(false))
  }, [user])

  async function save() {
    setMsg('')
    setError('')
    try {
      await api.put('/api/doctors/me', form)
      setMsg('Datos guardados. Así te van a ver los pacientes en WhatsApp.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Datos profesionales</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <Alert kind="error">{error}</Alert>}
        {msg && <Alert kind="ok">{msg}</Alert>}
        {loading ? (
          <InlineLoader />
        ) : (
        <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Nombre y apellido</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Especialidad</Label>
            <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
          </div>
        </div>
        <Button className="mt-4" onClick={save} disabled={!form.name || !form.specialty}>
          Guardar datos
        </Button>
        </>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- WhatsApp ----------

function WhatsApp() {
  const { user } = useAuth()
  const [form, setForm] = useState({ whatsappPhoneNumberId: '', whatsappDisplayPhone: '' })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api
      .get<Doctor[]>('/api/doctors')
      .then((ds) => {
        const me = ds.find((d) => d.id === user?.doctorId)
        if (me) {
          setForm({
            whatsappPhoneNumberId: me.whatsappPhoneNumberId || '',
            whatsappDisplayPhone: me.whatsappDisplayPhone || '',
          })
        }
      })
      .finally(() => setLoading(false))
  }, [user])

  async function save() {
    setMsg('')
    setError('')
    try {
      const me = await api.get<Doctor[]>('/api/doctors').then((ds) => ds.find((d) => d.id === user?.doctorId))
      await api.put('/api/doctors/me', {
        name: me?.name,
        specialty: me?.specialty,
        whatsappPhoneNumberId: form.whatsappPhoneNumberId || null,
        whatsappDisplayPhone: form.whatsappDisplayPhone || null,
      })
      setMsg('Configuración de WhatsApp guardada.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>WhatsApp del consultorio</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <Alert kind="error">{error}</Alert>}
        {msg && <Alert kind="ok">{msg}</Alert>}
        {loading ? (
          <InlineLoader />
        ) : (
        <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>ID emisor Twilio / Phone Number ID Meta</Label>
            <Input
              value={form.whatsappPhoneNumberId}
              placeholder="Twilio sandbox: +14155238886"
              onChange={(e) => setForm({ ...form, whatsappPhoneNumberId: e.target.value })}
            />

          </div>
          <div className="grid gap-2">
            <Label>Número visible para pacientes</Label>
            <Input
              value={form.whatsappDisplayPhone}
              placeholder="+54 9 261 555-1234"
              onChange={(e) => setForm({ ...form, whatsappDisplayPhone: e.target.value })}
            />
          </div>
        </div>
        <Button className="mt-4" onClick={save}>
          Guardar WhatsApp
        </Button>
        {user?.doctorId && (
          <p className="mt-4 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
            <span className="font-medium">Página pública para pacientes: </span>
            <a
              className="break-all text-primary underline-offset-2 hover:underline"
              href={`/d/${user.doctorId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {window.location.origin}/d/{user.doctorId}
            </a>
          </p>
        )}
        </>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Información del bot (menú WhatsApp) ----------

function InfoBot() {
  const confirm = useConfirm()
  const { user } = useAuth()
  const doctorId = user?.doctorId
  const [items, setItems] = useState<InfoContent[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<InfoContent | null>(null)
  const [form, setForm] = useState({ title: '', body: '' })
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(() => {
    if (!doctorId) return
    setLoading(true)
    api
      .get<InfoContent[]>('/api/info')
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [doctorId])

  useEffect(load, [load])

  async function save() {
    if (!doctorId) return
    setError('')
    setMsg('')
    try {
      if (editing) {
        await api.put(`/api/info/${editing.id}`, { ...editing, ...form })
        setMsg('Texto actualizado.')
      } else {
        await api.post('/api/info', { ...form, sortOrder: items.length + 1, doctorId })
        setMsg('Texto agregado al menú Información del bot.')
      }
      setForm({ title: '', body: '' })
      setEditing(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  if (!doctorId) return null

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Información para pacientes (bot WhatsApp)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Estos textos aparecen cuando el paciente elige <strong>Información</strong> en el menú del
          bot: obras sociales, indicaciones, formas de pago, etc.
        </p>
        {error && <Alert kind="error">{error}</Alert>}
        {msg && <Alert kind="ok">{msg}</Alert>}
        {loading ? (
          <InlineLoader />
        ) : (
          <>
            {items.length === 0 ? (
              <Empty>Todavía no cargaste textos de información.</Empty>
            ) : (
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
                        <TableCell className="max-w-md whitespace-pre-wrap text-sm">{i.body}</TableCell>
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
            )}
            <div className="mt-5 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label>Título (aparece en el menú)</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej. Obras sociales"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Contenido</Label>
                <Textarea
                  rows={4}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Texto que verá el paciente al elegir esta opción…"
                />
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

// ---------- Sedes propias ----------

function MisSedes() {
  const [items, setItems] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', address: '', notes: '', isHomeVisit: false, isVirtualVisit: false })
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api
      .get<Location[]>('/api/locations')
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  async function add() {
    setError('')
    try {
      await api.post('/api/locations', form)
      setForm({ name: '', address: '', notes: '', isHomeVisit: false, isVirtualVisit: false })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Mis lugares de atención</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <Alert kind="error">{error}</Alert>}
        {loading ? (
          <InlineLoader />
        ) : items.length === 0 ? (
          <Empty>Todavía no cargaste ninguna sede. Agregá la primera acá abajo.</Empty>
        ) : (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
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
                    <TableCell>
                      {l.isVirtualVisit ? 'Virtual' : l.isHomeVisit ? 'A domicilio' : 'Consultorio'}
                    </TableCell>
                    <TableCell>
                      {l.isVirtualVisit
                        ? 'Videollamada (Meet)'
                        : l.isHomeVisit
                          ? 'Visita al paciente'
                          : l.address}
                    </TableCell>
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
        )}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="grid gap-2 sm:col-span-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.isVirtualVisit}
                onChange={(e) =>
                  setForm({
                    ...form,
                    isVirtualVisit: e.target.checked,
                    isHomeVisit: e.target.checked ? false : form.isHomeVisit,
                    name: e.target.checked && !form.name ? 'Consulta virtual' : form.name,
                  })
                }
                className="size-4 rounded border-input"
              />
              Consulta virtual — videollamada (Google Meet por Gmail)
            </label>
            {form.isVirtualVisit && (
              <p className="text-sm text-muted-foreground">
                El paciente debe dejar su email al reservar. Vos enviás el enlace de Meet por Gmail ~1
                hora antes; al confirmar el turno el bot avisa eso por WhatsApp.
              </p>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.isHomeVisit}
                disabled={form.isVirtualVisit}
                onChange={(e) =>
                  setForm({
                    ...form,
                    isHomeVisit: e.target.checked,
                    isVirtualVisit: e.target.checked ? false : form.isVirtualVisit,
                    name: e.target.checked && !form.name ? 'A domicilio' : form.name,
                  })
                }
                className="size-4 rounded border-input"
              />
              Atención a domicilio — vos visitás al paciente en su casa
            </label>
            {form.isHomeVisit && (
              <p className="text-sm text-muted-foreground">
                La dirección del paciente (calle, número, localidad) se pide al reservar el turno por
                WhatsApp o al cargarlo manualmente en el panel. Acá solo configurás la modalidad y tu
                zona de cobertura.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label>
              {form.isVirtualVisit || form.isHomeVisit ? 'Nombre (opcional)' : 'Nombre'}
            </Label>
            <Input
              value={form.name}
              placeholder={
                form.isVirtualVisit
                  ? 'Consulta virtual'
                  : form.isHomeVisit
                    ? 'A domicilio'
                    : 'Consultorio Centro…'
              }
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>
              {form.isVirtualVisit
                ? 'Detalle (opcional)'
                : form.isHomeVisit
                  ? 'Zona de cobertura (opcional)'
                  : 'Dirección'}
            </Label>
            <Input
              value={form.address}
              placeholder={
                form.isVirtualVisit
                  ? 'Ej. Google Meet'
                  : form.isHomeVisit
                    ? 'Ej. Córdoba capital'
                    : ''
              }
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
                form.isVirtualVisit
                  ? 'Ej. Enlace Meet, indicaciones previas…'
                  : form.isHomeVisit
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
          disabled={
            !form.isHomeVisit && !form.isVirtualVisit && (!form.name || !form.address)
          }
        >
          <Plus className="size-4" />
          Agregar sede
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">
          Después de crear una sede (o la opción a domicilio), cargá tus días y horarios en{' '}
          <Link to="/disponibilidad" className="font-medium text-primary underline-offset-2 hover:underline">
            Disponibilidad
          </Link>{' '}
          para que el bot pueda ofrecer turnos ahí.
        </p>
      </CardContent>
    </Card>
  )
}

// ---------- Cambio de contraseña ----------

function CambioPassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', repeat: '' })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function save() {
    setMsg('')
    setError('')
    if (form.newPassword !== form.repeat) {
      setError('Las contraseñas nuevas no coinciden')
      return
    }
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      setMsg('Contraseña actualizada correctamente.')
      setForm({ currentPassword: '', newPassword: '', repeat: '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <Alert kind="error">{error}</Alert>}
        {msg && <Alert kind="ok">{msg}</Alert>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label>Contraseña actual</Label>
            <Input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Nueva contraseña</Label>
            <Input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Repetir nueva contraseña</Label>
            <Input
              type="password"
              value={form.repeat}
              onChange={(e) => setForm({ ...form, repeat: e.target.value })}
            />
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={save}
          disabled={!form.currentPassword || form.newPassword.length < 6 || !form.repeat}
        >
          Cambiar contraseña
        </Button>
      </CardContent>
    </Card>
  )
}
