import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../api'
import type { PanelUser } from '../types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ActiveBadge, Alert, PageHeader, PageLoading, TableScroll } from '../components/page'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  DOCTOR: 'Doctor/a',
  SECRETARIA: 'Secretaría',
}

export default function Usuarios() {
  const [users, setUsers] = useState<PanelUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [form, setForm] = useState({ name: '', specialty: '', username: '', password: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api
      .get<PanelUser[]>('/api/users')
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  async function createDoctor() {
    setBusy(true)
    setError('')
    setOk('')
    try {
      await api.post('/api/users/doctor', form)
      setOk(`Cuenta creada: la doctora ya puede ingresar con el usuario "${form.username}" y completar sus datos.`)
      setForm({ name: '', specialty: '', username: '', password: '' })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword(u: PanelUser) {
    const password = prompt(`Nueva contraseña para ${u.username} (mínimo 6 caracteres):`)
    if (!password) return
    setError('')
    setOk('')
    try {
      await api.post(`/api/users/${u.id}/reset-password`, { password })
      setOk(`Contraseña de ${u.username} actualizada.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  async function toggleActive(u: PanelUser) {
    setError('')
    setOk('')
    try {
      await api.post(`/api/users/${u.id}/toggle-active`)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <>
      <PageHeader
        title="Usuarios del panel"
        description="Cuentas de acceso. Cada doctora gestiona su propio consultorio al ingresar."
      />
      {error && <Alert kind="error">{error}</Alert>}
      {ok && <Alert kind="ok">{ok}</Alert>}

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Cuentas existentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoading />
          ) : (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Profesional vinculado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-semibold">{u.username}</TableCell>
                    <TableCell>{u.fullName}</TableCell>
                    <TableCell>{ROLE_LABEL[u.role] || u.role}</TableCell>
                    <TableCell>{u.doctor ? `${u.doctor.name} (${u.doctor.specialty})` : '—'}</TableCell>
                    <TableCell>
                      <ActiveBadge active={u.active} labels={['Activo', 'Inactivo']} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button size="sm" variant="outline" onClick={() => resetPassword(u)}>
                          Resetear contraseña
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => toggleActive(u)}
                        >
                          {u.active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nueva doctora</CardTitle>
          <CardDescription>
            Crea el profesional y su cuenta del panel. Al ingresar, ella completa sus sedes, horarios y datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Nombre y apellido</Label>
              <Input value={form.name} placeholder="Dra. …" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Especialidad</Label>
              <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Usuario</Label>
              <Input
                value={form.username}
                placeholder="dra.apellido"
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Contraseña inicial</Label>
              <Input
                value={form.password}
                placeholder="Mínimo 6 caracteres"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>
          <Button
            className="mt-4"
            disabled={busy || !form.name || !form.specialty || !form.username || form.password.length < 6}
            onClick={createDoctor}
          >
            <Plus className="size-4" />
            Crear doctora y cuenta
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
