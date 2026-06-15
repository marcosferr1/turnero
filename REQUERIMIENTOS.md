# Toma de requerimientos — Turnero Médico con Chatbot de WhatsApp

## 1. Resumen

Sistema de gestión de turnos médicos compuesto por:

- Un **chatbot de WhatsApp** con flujos preseteados (sin IA) por el cual los pacientes
  reciben información, consultan horarios y disponibilidad, ven los lugares de atención
  y solicitan turnos.
- Un **panel de administración web** donde la doctora/secretaria gestiona las solicitudes,
  la agenda, la disponibilidad y la configuración.
- **Mensajes automáticos** de confirmación, recordatorio y cancelación.

## 2. Decisiones de producto

| Tema | Decisión |
| --- | --- |
| Integración WhatsApp | Cloud API oficial de Meta, con número dedicado |
| Alcance | Una doctora hoy; el modelo soporta varios doctores independientes |
| Confirmación de turnos | **Manual**: la solicitud queda `pendiente` (bloquea el slot) hasta que se apruebe o rechace desde el panel |
| Datos del paciente | Nombre y apellido, DNI, obra social/prepaga y motivo de consulta |
| Mensajes salientes | Solicitud recibida, confirmación al aprobar, recordatorio 24 hs antes, aviso de cancelación/reprogramación |
| Stack | Backend Node + TypeScript + Express + Prisma · Panel React + Vite · PostgreSQL |

## 3. Actores

- **Paciente**: interactúa únicamente por WhatsApp.
- **Doctora / Secretaria / Admin**: usuarios del panel web.

## 4. Requerimientos funcionales

### 4.1 Chatbot (flujos preseteados)

- RF-01 — Menú principal con opciones: Información, Lugares de atención, Disponibilidad, Agendar turno, Mis turnos.
- RF-02 — **Información**: textos configurables desde el panel (preparación de estudios, obras sociales aceptadas, etc.).
- RF-03 — **Lugares de atención**: lista de sedes con dirección y días de atención.
- RF-04 — **Disponibilidad**: consulta de días y horarios libres por doctor y sede.
- RF-05 — **Agendar turno**: elegir doctor (si hay más de uno) → sede → día → horario libre → carga de datos (nombre, DNI, obra social, motivo) → solicitud `pendiente` + mensaje "solicitud recibida".
- RF-06 — **Mis turnos**: ver turnos próximos y cancelarlos (libera el slot).
- RF-07 — El estado de la conversación se persiste en la base; el comando `menu` (u "hola") vuelve al menú; las conversaciones inactivas más de 30 minutos se reinician.
- RF-08 — Un slot con solicitud `pendiente` o turno `confirmado` no puede volver a ofrecerse.

### 4.2 Panel de administración

- RF-09 — Login con usuario y contraseña (JWT). Roles: admin, doctor, secretaria.
- RF-10 — **Bandeja de pendientes**: aprobar (envía confirmación por WhatsApp) o rechazar (envía aviso) solicitudes.
- RF-11 — **Agenda**: vista diaria/semanal de turnos; cancelar o reprogramar (envía aviso al paciente).
- RF-12 — **Disponibilidad**: horarios semanales por doctor y sede, duración del turno y bloqueos puntuales (vacaciones, feriados).
- RF-13 — **Pacientes**: listado con historial de turnos.
- RF-14 — **Configuración**: sedes, textos de información del bot y datos de los doctores.
- RF-15 — Creación manual de turnos desde el panel (por teléfono).

### 4.3 Notificaciones automáticas

- RF-16 — Mensaje inmediato de "solicitud recibida" al agendar por el bot.
- RF-17 — Plantilla de confirmación cuando el turno se aprueba.
- RF-18 — Recordatorio 24 hs antes del turno confirmado (job programado).
- RF-19 — Aviso al paciente si la doctora cancela o reprograma.

## 5. Requerimientos no funcionales

- RNF-01 — Sin IA: máquina de estados determinística.
- RNF-02 — Zona horaria fija configurable (Argentina, UTC-3, sin DST).
- RNF-03 — Auditoría: log de todos los mensajes entrantes y salientes.
- RNF-04 — Modo **simulador** local para probar los flujos del bot sin cuenta de Meta.
- RNF-05 — Webhook de Meta verificado con token y firma.

## 6. Estados del turno

`pendiente` → `confirmado` | `rechazado`
`pendiente`/`confirmado` → `cancelado_paciente` | `cancelado_doctor`
`confirmado` → `completado`

## 7. Arquitectura

```
Paciente (WhatsApp) ⇄ Meta Cloud API ⇄ Backend Node (webhook + API REST + cron) ⇄ PostgreSQL
                                              ⇡ REST + JWT
                                         Panel React (Vite)
```

## 8. Estructura del repositorio

```
backend/   API REST + webhook del bot + jobs (Node, TypeScript, Express, Prisma)
panel/     Panel de administración (React, Vite, TypeScript)
docs/      Guía de puesta en marcha con Meta Business
```
