# Backend en Railway — variables y Baileys

## Variables obligatorias (Railway → backend → Variables)

| Variable | Ejemplo / notas |
| --- | --- |
| `DATABASE_URL` | Neon pooled (`...-pooler...`) |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `WHATSAPP_MODE` | `baileys` |
| `BAILEYS_PHONE` | `5493517714542` |
| `BAILEYS_QR_SECRET` | `openssl rand -hex 24` |
| `APP_UTC_OFFSET` | `-03:00` |
| `CORS_ORIGIN` | URL del panel en Vercel |
| `NODE_ENV` | `production` |

**No** agregues `PORT` (Railway lo setea).

## Vercel (panel)

| Variable | Valor |
| --- | --- |
| `VITE_API_URL` | URL pública del backend Railway, sin `/` final |

Redeploy del panel después de cambiar `VITE_API_URL`.

## Sesión Baileys persistente (Volume)

Sin volumen, cada redeploy pide escanear el QR de nuevo.

1. Railway → servicio backend → **Volumes** → **Add Volume**
2. Mount path: `/app/.baileys_auth` (o el valor de `BAILEYS_AUTH_DIR`)
3. Redeploy

La carpeta `.baileys_auth` guarda la sesión de WhatsApp vinculada.

## Vincular WhatsApp

1. En Railway, copiá el valor de `BAILEYS_QR_SECRET` (no lo pegues en logs ni chats).
2. Abrí en el celular: `https://TU-BACKEND/baileys/qr?token=TU_SECRETO`
3. WhatsApp → Dispositivos vinculados → escanear

En producción los logs **no** incluyen el token; solo muestran la URL base y te indican usar la variable de Railway.

Si el token apareció en logs antiguos, **rotalo** (`openssl rand -hex 24`) y redeploy.

## Sesión estable (evitar desconexión 408 de noche)

El código **408** suele ser timeout: la sesión se perdió o el contenedor reinició.

- **Obligatorio**: Volume montado en `/app/.baileys_auth` (ver arriba).
- Sin volume, cada redeploy o restart pide QR de nuevo.
- Si se desconecta, los logs de QR se repiten como máximo **una vez cada 5 minutos** (no spamean el secreto).

## Anti-detección Baileys (comportamiento humano)

Por defecto el bot simula respuesta humana en **todos** los mensajes salientes (conversación y notificaciones):

| Variable | Default | Notas |
| --- | --- | --- |
| `BAILEYS_HUMANIZE` | `true` | `false` desactiva retraso y presencia |
| `BAILEYS_REPLY_DELAY_MIN_MS` | `2000` | Mínimo antes de enviar |
| `BAILEYS_REPLY_DELAY_MAX_MS` | `4000` | Máximo antes de enviar |

- Antes de cada mensaje: estado **escribiendo** + espera aleatoria 2–4 s.
- Menús: solo **texto numerado** (1, 2, 3…). No uses `BAILEYS_NATIVE_MENUS=true` en producción.
- Saludos y pregunta del menú principal varían levemente entre conversaciones.

**Nota:** un job con muchos recordatorios tardará ~2–4 s por paciente. Para desactivar: `BAILEYS_HUMANIZE=false`.
