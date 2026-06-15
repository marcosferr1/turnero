import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import type { Doctor, Location } from '../types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ActiveBadge, Alert, Empty, InlineLoader, PageHeader, TableScroll } from '../components/page'

export default function MiConsultorio() {
  return (
    <>
      <PageHeader
        title="Mi consultorio"
        description="Tus datos profesionales, tus lugares de atención y tu contraseña."
      />
      <Perfil />
      <WhatsApp />
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
        <p className="mb-4 text-sm text-muted-foreground">
          Número de WhatsApp del consultorio. Con Twilio: en <strong>ID emisor</strong> va el número
          de Twilio (sandbox +14155238886 o tu sender aprobado); en <strong>número visible</strong> va
          el que ven los pacientes (ej. +54 9 351…).
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>ID emisor Twilio / Phone Number ID Meta</Label>
            <Input
              value={form.whatsappPhoneNumberId}
              placeholder="Twilio sandbox: +14155238886"
              onChange={(e) => setForm({ ...form, whatsappPhoneNumberId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Twilio: número desde el que envía la API (sandbox o sender). Meta: Phone Number ID.
            </p>
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

// ---------- Sedes propias ----------

function MisSedes() {
  const [items, setItems] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', address: '', notes: '' })
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
      setForm({ name: '', address: '', notes: '' })
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
                  <TableHead>Dirección</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-semibold">{l.name}</TableCell>
                    <TableCell>{l.address}</TableCell>
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
          <div className="grid gap-2">
            <Label>Nombre</Label>
            <Input
              value={form.name}
              placeholder="Consultorio Centro…"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Dirección</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Notas (opcional)</Label>
            <Input
              value={form.notes}
              placeholder="Piso, timbre, indicaciones…"
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <Button className="mt-4" onClick={add} disabled={!form.name || !form.address}>
          <Plus className="size-4" />
          Agregar sede
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">
          Después de crear una sede, cargá tus días y horarios en{' '}
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
