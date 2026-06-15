export interface User {
  id: number
  username: string
  fullName: string
  role: string
  doctorId?: number | null
}

export interface PanelUser {
  id: number
  username: string
  fullName: string
  role: string
  active: boolean
  doctor: { id: number; name: string; specialty: string } | null
}

export interface Doctor {
  id: number
  name: string
  specialty: string
  active: boolean
  whatsappPhoneNumberId?: string | null
  whatsappDisplayPhone?: string | null
}

export interface SimDoctor {
  id: number
  name: string
  specialty: string
  whatsappDisplayPhone?: string | null
  whatsappPhoneNumberId?: string | null
}

export interface Location {
  id: number
  doctorId: number
  name: string
  address: string
  notes?: string | null
  isHomeVisit: boolean
  active: boolean
  doctor?: { id: number; name: string }
}

export interface Schedule {
  id: number
  doctorId: number
  locationId: number
  weekday: number
  startTime: string
  endTime: string
  slotMinutes: number
  location: Location
  doctor: Doctor
}

export interface Block {
  id: number
  doctorId: number
  dateFrom: string
  dateTo: string
  reason?: string | null
  doctor: Doctor
}

export interface Patient {
  id: number
  phone: string
  fullName?: string | null
  dni?: string | null
  insurance?: string | null
  createdAt: string
  _count?: { appointments: number }
  appointments?: Appointment[]
}

export type AppointmentStatus =
  | 'PENDIENTE'
  | 'CONFIRMADO'
  | 'RECHAZADO'
  | 'CANCELADO_PACIENTE'
  | 'CANCELADO_DOCTOR'
  | 'COMPLETADO'

export interface Appointment {
  id: number
  doctorId: number
  locationId: number
  patientId: number
  date: string
  time: string
  durationMinutes: number
  status: AppointmentStatus
  motivo?: string | null
  patientAddress?: string | null
  createdVia: string
  doctor: Doctor
  location: Location
  patient: Patient
}

export interface InfoContent {
  id: number
  doctorId: number
  title: string
  body: string
  sortOrder: number
  active: boolean
}

export interface DaySummary {
  date: string
  slots: string[]
}

export interface SimReply {
  kind: 'text' | 'list' | 'buttons' | 'template'
  text: string
  options?: { id: string; title: string; description?: string }[]
}

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  RECHAZADO: 'Rechazado',
  CANCELADO_PACIENTE: 'Cancelado (paciente)',
  CANCELADO_DOCTOR: 'Cancelado (consultorio)',
  COMPLETADO: 'Completado',
}

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
