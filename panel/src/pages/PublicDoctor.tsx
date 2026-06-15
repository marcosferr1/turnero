import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Calendar, Clock, MapPin, MessageCircle, Moon, Stethoscope, Sun } from 'lucide-react'
import { publicApi } from '../api'
import { formatLong, formatShort } from '../lib'
import { useTheme } from '../theme'
import { WEEKDAYS, type DaySummary } from '../types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '../components/page'

interface PublicSchedule {
  weekday: number
  startTime: string
  endTime: string
  slotMinutes: number
}

interface PublicLocation {
  id: number
  name: string
  address: string
  notes: string | null
  schedules: PublicSchedule[]
  availability: DaySummary[]
}

interface PublicDoctorProfile {
  id: number
  name: string
  specialty: string
  whatsappDisplayPhone: string | null
  whatsappUrl: string | null
  locations: PublicLocation[]
}

export default function PublicDoctor() {
  const { doctorId } = useParams()
  const { theme, toggle } = useTheme()
  const [profile, setProfile] = useState<PublicDoctorProfile | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [locationId, setLocationId] = useState<number | null>(null)

  useEffect(() => {
    const id = parseInt(doctorId || '', 10)
    if (isNaN(id)) {
      setError('Enlace no válido')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    publicApi
      .get<PublicDoctorProfile>(`/api/public/doctors/${id}`)
      .then((data) => {
        setProfile(data)
        setLocationId(data.locations[0]?.id ?? null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el perfil'))
      .finally(() => setLoading(false))
  }, [doctorId])

  const location = profile?.locations.find((l) => l.id === locationId) ?? profile?.locations[0]

  return (
    <div className="min-h-dvh bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Stethoscope className="size-4" />
          </div>
          Turnero<span className="text-primary">Médico</span>
        </div>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Cambiar tema">
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-10">
        {loading && <PageLoading label="Cargando perfil…" />}

        {!loading && error && (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link to="/login">Ir al panel</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && profile && (
          <Card className="overflow-hidden shadow-lg ring-1 ring-foreground/5">
            <CardHeader className="gap-3 border-b bg-primary/5 pb-5">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Stethoscope className="size-7" />
              </div>
              <div>
                <CardTitle className="text-xl">{profile.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{profile.specialty}</p>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-5">
              {profile.locations.length > 1 && (
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Lugar de atención</label>
                  <Select
                    value={locationId != null ? String(locationId) : undefined}
                    onValueChange={(v) => setLocationId(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Elegir sede" />
                    </SelectTrigger>
                    <SelectContent>
                      {profile.locations.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {location && (
                <>
                  <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">{location.name}</p>
                      <p className="text-sm text-muted-foreground">{location.address}</p>
                      {location.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">{location.notes}</p>
                      )}
                    </div>
                  </div>

                  {location.schedules.length > 0 && (
                    <div>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <Clock className="size-4 text-primary" />
                        Horarios de atención
                      </h3>
                      <ul className="space-y-1.5 text-sm">
                        {location.schedules.map((s, i) => (
                          <li
                            key={i}
                            className="flex justify-between rounded-md border px-3 py-2"
                          >
                            <span>{WEEKDAYS[s.weekday]}</span>
                            <span className="text-muted-foreground">
                              {s.startTime} – {s.endTime}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Calendar className="size-4 text-primary" />
                      Próximos turnos disponibles
                    </h3>
                    {location.availability.length === 0 ? (
                      <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                        No hay horarios libres en las próximas semanas.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {location.availability.map((day) => (
                          <div key={day.date} className="rounded-lg border p-3">
                            <p className="mb-2 text-sm font-medium">
                              {formatShort(day.date)}{' '}
                              <span className="font-normal text-muted-foreground">
                                ({formatLong(day.date)})
                              </span>
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {day.slots.map((t) => (
                                <Badge key={t} variant="secondary" className="font-normal">
                                  {t} hs
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {profile.whatsappUrl ? (
                <Button className="h-11 w-full gap-2 text-base" asChild>
                  <a href={profile.whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-5" />
                    Pedir turno por WhatsApp
                  </a>
                </Button>
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                  WhatsApp no configurado. Contactá al consultorio por otro medio.
                </p>
              )}

              {profile.whatsappDisplayPhone && (
                <p className="text-center text-xs text-muted-foreground">
                  {profile.whatsappDisplayPhone}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
