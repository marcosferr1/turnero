import { useEffect, useState } from 'react'
import { api } from '../api'
import { InlineLoader } from './page'

interface Props {
  doctorId: number
  locationId: number
  date: string
  value: string
  onChange: (time: string) => void
}

/** Muestra los horarios libres de un día como botones seleccionables. */
export default function SlotPicker({ doctorId, locationId, date, value, onChange }: Props) {
  const [slots, setSlots] = useState<string[] | null>(null)

  useEffect(() => {
    setSlots(null)
    if (!doctorId || !locationId || !date) return
    api
      .get<string[]>(`/api/availability/slots?doctorId=${doctorId}&locationId=${locationId}&date=${date}`)
      .then(setSlots)
      .catch(() => setSlots([]))
  }, [doctorId, locationId, date])

  if (!doctorId || !locationId || !date)
    return <p className="text-sm text-muted-foreground">Elegí doctor, sede y fecha.</p>
  if (slots === null) return <InlineLoader label="Cargando horarios…" />
  if (slots.length === 0)
    return <p className="text-sm text-muted-foreground">No hay horarios libres ese día.</p>

  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            value === t
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card hover:border-primary hover:text-primary'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
