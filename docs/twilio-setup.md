# Twilio WhatsApp — puesta en marcha

Guía para conectar el turnero con **Twilio** en lugar de Meta Cloud API directo.

## 1. Cuenta Twilio

1. Creá cuenta en [console.twilio.com](https://console.twilio.com).
2. Anotá **Account SID** y **Auth Token** (Dashboard → Account Info).

## 2. Sandbox (desarrollo, ~5 minutos)

Ideal para probar el bot antes de tener un número propio aprobado.

1. Console → **Messaging** → **Try it out** → **Send a WhatsApp message**.
2. Seguí las instrucciones: desde tu celular mandá el código de join al número sandbox (ej. `join …` al `+1 415 523 8886`).
3. Copiá el número sandbox (formato `+14155238886`).

## 3. Variables de entorno

En `backend/.env`:

```env
WHATSAPP_MODE=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_FROM=+14155238886
```

Reiniciá el backend: `npm run dev`.

## 4. Webhook con ngrok

Twilio necesita una URL pública para mensajes entrantes.

```bash
ngrok http 3001
```

En Twilio Console → sandbox WhatsApp → **When a message comes in**:

```
https://TU-NGROK.ngrok-free.app/webhook/twilio
```

Método: **HTTP POST**.

## 5. Doctor en el panel

**Mi consultorio → WhatsApp:**

| Campo | Sandbox | Producción |
|-------|---------|------------|
| Número visible | Tu celular (para wa.me) | +54 9 351 771-4542 |
| ID / routing | Mismo número Twilio `+14155238886` | Tu número Twilio aprobado |

El bot identifica al doctor comparando el número **To** del webhook con el configurado en el panel.

## 6. Probar

1. Unite al sandbox desde tu celular (paso 2).
2. Mandá **`hola`** al número sandbox de Twilio.
3. Deberías recibir el menú del bot con opciones numeradas (1, 2, 3…).

## 7. Producción con tu número argentino

1. Twilio Console → **Messaging** → **Senders** → **WhatsApp senders**.
2. Solicitá registrar tu número (+54 9 351 771-4542).
3. Twilio gestiona la verificación con Meta (suele ser más simple que hacerlo directo).
4. Actualizá `TWILIO_WHATSAPP_FROM=+5493517714542` y el número en Mi consultorio.

## Diferencias vs Meta Cloud API

| Aspecto | Meta directo | Twilio |
|---------|--------------|--------|
| Listas / botones | Interactivos nativos | Texto numerado (respondé 1, 2, 3) |
| Plantillas | Meta templates | Texto plano (recordatorios dentro de 24 h) |
| Webhook | `/webhook` | `/webhook/twilio` |
| Multi-doctor | Por phone_number_id Meta | Por número To en panel |

## Costos

- Twilio cobra por mensaje WhatsApp + fee Twilio (ver [pricing Twilio WhatsApp](https://www.twilio.com/whatsapp/pricing)).
- Sandbox: gratis para pruebas con números unidos al sandbox.
