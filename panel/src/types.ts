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
  isVirtualVisit: boolean
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
  email?: string | null
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

export type AppointmentEventType =
  | 'SOLICITUD_CREADA'
  | 'CREADO_PANEL'
  | 'CONFIRMADO'
  | 'RECHAZADO'
  | 'CANCELADO_PACIENTE'
  | 'CANCELADO_DOCTOR'
  | 'COMPLETADO'
  | 'REPROGRAMADO'
  | 'RECORDATORIO_ENVIADO'

export type AppointmentActor = 'BOT' | 'PANEL' | 'PATIENT' | 'SYSTEM'

export interface AppointmentEvent {
  id: number
  appointmentId: number
  doctorId: number
  type: AppointmentEventType
  actor: AppointmentActor
  userId?: number | null
  metadata?: {
    oldDate?: string
    oldTime?: string
    newDate?: string
    newTime?: string
  } | null
  createdAt: string
  appointment: {
    id: number
    date: string
    time: string
    status: AppointmentStatus
    patient: { id: number; phone: string; fullName?: string | null }
    location: { id: number; name: string; isHomeVisit: boolean; isVirtualVisit: boolean }
  }
  user?: { id: number; fullName: string } | null
}

export const EVENT_LABEL: Record<AppointmentEventType, string> = {
  SOLICITUD_CREADA: 'Nueva solicitud de turno',
  CREADO_PANEL: 'Turno agregado desde el panel',
  CONFIRMADO: 'Turno confirmado',
  RECHAZADO: 'Solicitud rechazada',
  CANCELADO_PACIENTE: 'Cancelado por el paciente',
  CANCELADO_DOCTOR: 'Cancelado por el consultorio',
  COMPLETADO: 'Turno completado',
  REPROGRAMADO: 'Turno reprogramado',
  RECORDATORIO_ENVIADO: 'Recordatorio enviado',
}

export const ACTOR_LABEL: Record<AppointmentActor, string> = {
  BOT: 'WhatsApp',
  PANEL: 'Panel',
  PATIENT: 'Paciente',
  SYSTEM: 'Sistema',
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
