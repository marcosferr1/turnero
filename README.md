# Turnero Médico con Chatbot de WhatsApp

Sistema de turnos médicos con:

- **Chatbot de WhatsApp** de pasos preseteados (sin IA): información, lugares de
  atención, disponibilidad, agendado y cancelación de turnos.
- **Panel de administración** (React): bandeja de solicitudes pendientes, agenda
  semanal, disponibilidad, pacientes, configuración y un simulador del bot.
- **Notificaciones automáticas**: confirmación, recordatorio 24 hs antes y avisos
  de cancelación/reprogramación.

Documentos: [REQUERIMIENTOS.md](REQUERIMIENTOS.md) (toma de requerimientos) y
[docs/puesta-en-marcha.md](docs/puesta-en-marcha.md) (conexión con Meta).

## Stack

| Componente | Tecnología |
| --- | --- |
| Backend | Node 20, TypeScript, Express, Prisma |
| Panel | React 19, Vite, TypeScript |
| Base de datos | PostgreSQL 16 (Docker) |
| WhatsApp | Cloud API oficial de Meta (o simulador local) |

## Cómo correr el proyecto

```bash
# 1. Base de datos (Postgres en el puerto 5434)
docker compose up -d postgres

# 2. Backend (puerto 3001)
cd backend
cp .env.example .env        # ajustar si hace falta
npm install
npx prisma migrate deploy   # crea las tablas
npm run seed                # admin + doctora de ejemplo
npm run dev

# 3. Panel (puerto 5174)
cd ../panel
npm install
npm run dev
```

Abrí [http://localhost:5174](http://localhost:5174) e ingresá con alguno de los usuarios del seed:


## Roles

- **ADMIN**: acceso total. Da de alta a cada doctora desde **Usuarios** (crea el profesional y su
  cuenta en un paso), puede resetear contraseñas y desactivar cuentas.
- **DOCTOR**: al ingresar ve únicamente lo suyo. Desde **Mi consultorio** completa sus datos
  profesionales, crea sus sedes propias y cambia su contraseña; desde **Disponibilidad** carga
  sus días, horarios por sede y bloqueos (vacaciones/ausencias). Las sedes son propias de cada
  profesional.

## Probar el bot sin cuenta de Meta

Con `WHATSAPP_MODE=simulator` (valor por defecto en `.env`), entrá a la sección
**Simulador** del panel y escribí `hola`. Podés recorrer todos los flujos: agendar
un turno, consultarlo, cancelarlo, etc. Las solicitudes aparecen en **Pendientes**
para confirmarlas o rechazarlas, y cada acción muestra el mensaje de WhatsApp que
recibiría el paciente.

## Estructura

```
backend/
  prisma/            esquema, migraciones y seed
  src/
    bot/             webhook de Meta, máquina de estados y cliente de envío
    jobs/            cron de recordatorios (24 hs antes)
    lib/             utilidades de fechas (zona horaria fija)
    middleware/      autenticación JWT
    routes/          API REST del panel + simulador
    services/        slots disponibles, turnos y notificaciones
panel/
  src/
    pages/           Pendientes, Agenda, Disponibilidad, Pacientes,
                     Configuración, Simulador, Login
    components/      componentes compartidos
docs/
  puesta-en-marcha.md  guía de configuración de Meta Business
```

## Flujo de un turno

1. El paciente agenda por WhatsApp → solicitud `PENDIENTE` (el horario queda bloqueado).
2. La doctora/secretaria la **confirma o rechaza** desde el panel → el paciente recibe
   el aviso por WhatsApp.
3. 24 hs antes del turno confirmado se envía un **recordatorio** automático.
4. Si el consultorio cancela o reprograma, el paciente recibe el aviso correspondiente.
5. El paciente puede cancelar su turno desde el bot ("Mis turnos") y el horario se libera.
# turnero
