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

1. Logs: `[baileys] Escaneá el QR en /baileys/qr (agregá ?token=TU_BAILEYS_QR_SECRET)`
2. Abrí en el celular: `https://TU-BACKEND/baileys/qr?token=TU_SECRETO`
3. WhatsApp → Dispositivos vinculados → escanear
