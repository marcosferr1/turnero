import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../api'
import { formatLong } from '../lib'
import { type Patient } from '../types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Empty, InlineLoader, PageHeader, PageLoading, StatusBadge, TableScroll } from '../components/page'

export default function Pacientes() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Patient | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      api
        .get<Patient[]>(`/api/patients?search=${encodeURIComponent(search)}`)
        .then(setPatients)
        .catch(() => setPatients([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  function openDetail(id: number) {
    setDetailLoading(true)
    setSelected({ id } as Patient)
    api
      .get<Patient>(`/api/patients/${id}`)
      .then(setSelected)
      .catch(() => setSelected(null))
      .finally(() => setDetailLoading(false))
  }

  return (
    <>
      <PageHeader
        title="Pacientes"
        description="Personas que interactuaron con el bot o tienen turnos."
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-full pl-9"
              placeholder="Buscar por nombre, teléfono o DNI…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
      />

      <Card>
        <CardContent>
          {loading ? (
            <PageLoading />
          ) : patients.length === 0 ? (
            <Empty>No se encontraron pacientes.</Empty>
          ) : (
            <TableScroll>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Obra social</TableHead>
                    <TableHead>Turnos</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold">{p.fullName || 'Sin nombre'}</TableCell>
                      <TableCell>{p.phone}</TableCell>
                      <TableCell>{p.dni || '—'}</TableCell>
                      <TableCell>{p.insurance || '—'}</TableCell>
                      <TableCell>{p._count?.appointments ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openDetail(p.id)}>
                          Ver historial
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Dialog open onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{selected.fullName || selected.phone || 'Paciente'}</DialogTitle>
            </DialogHeader>
            {detailLoading || !selected.phone ? (
              <InlineLoader label="Cargando historial…" />
            ) : (
            <>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[110px_1fr]">
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd className="font-medium">{selected.phone}</dd>
              <dt className="text-muted-foreground">DNI</dt>
              <dd className="font-medium">{selected.dni || '—'}</dd>
              <dt className="text-muted-foreground">Obra social</dt>
              <dd className="font-medium">{selected.insurance || '—'}</dd>
            </dl>
            <h3 className="mt-2 text-sm font-semibold">Historial de turnos</h3>
            {!selected.appointments?.length ? (
              <Empty>Sin turnos registrados.</Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.appointments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{formatLong(a.date)}</TableCell>
                      <TableCell>{a.time} hs</TableCell>
                      <TableCell>
                        {a.location.isHomeVisit
                          ? `Domicilio${a.patientAddress ? ` — ${a.patientAddress}` : ''}`
                          : a.location.name}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
