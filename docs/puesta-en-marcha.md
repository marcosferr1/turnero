# Puesta en marcha con WhatsApp Cloud API (Meta)

Esta guía explica cómo conectar el turnero al WhatsApp real. Hasta completar estos
pasos podés usar el **simulador** del panel (`WHATSAPP_MODE=simulator`), que reproduce
los flujos sin cuenta de Meta.

## 1. Requisitos

- Una cuenta de **Meta Business** (business.facebook.com), idealmente verificada.
- Un **número de teléfono dedicado** que NO esté registrado en la app de WhatsApp
  (ni común ni Business). Puede ser una línea nueva o un fijo que reciba la llamada
  de verificación.
- El backend accesible por HTTPS desde internet (para el webhook). Para probar en
  desarrollo podés usar un túnel: `ngrok http 3001` o `cloudflared tunnel`.

## 2. Crear la app en Meta

1. Entrá a [developers.facebook.com](https://developers.facebook.com) → **Crear app** → tipo **Empresa**.
2. En el panel de la app, agregá el producto **WhatsApp**.
3. En **WhatsApp → Configuración de la API**:
   - Asociá tu cuenta de Meta Business.
   - Agregá y verificá el número de teléfono dedicado.
   - Copiá el **Phone number ID** → variable `WHATSAPP_PHONE_NUMBER_ID`.
4. Generá un **token permanente**:
   - En Meta Business Suite → Configuración → Usuarios del sistema, creá un usuario
     de sistema con rol admin, asignale la app y el activo de WhatsApp, y generá un
     token con permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
   - Copialo en la variable `WHATSAPP_TOKEN`.

## 3. Configurar el webhook

1. Elegí un valor secreto para `WHATSAPP_VERIFY_TOKEN` en `backend/.env`.
2. En la app de Meta → **WhatsApp → Configuración → Webhook**:
   - **URL de devolución de llamada**: `https://TU-DOMINIO/webhook`
   - **Token de verificación**: el mismo valor de `WHATSAPP_VERIFY_TOKEN`.
3. Meta hace un GET de verificación; el backend lo responde automáticamente.
4. Suscribite al campo **messages**.

## 4. Crear las plantillas de mensajes

Los mensajes que el sistema inicia (confirmaciones, recordatorios, cancelaciones)
requieren plantillas pre-aprobadas. En **WhatsApp Manager → Plantillas de mensajes**,
creá estas plantillas en idioma **es_AR**, categoría **Utility**, con estos nombres
exactos y variables de cuerpo:

| Nombre | Variables del cuerpo | Texto sugerido |
| --- | --- | --- |
| `turno_confirmado` | 1 nombre, 2 doctor, 3 fecha/hora, 4 lugar | Hola {{1}}, tu turno con {{2}} fue confirmado para el {{3}} en {{4}}. Si no podés asistir, escribinos para cancelarlo. |
| `turno_rechazado` | 1 nombre, 2 doctor, 3 fecha/hora | Hola {{1}}, no pudimos confirmar tu turno con {{2}} del {{3}}. Escribinos "hola" para buscar otro horario. |
| `turno_recordatorio` | 1 nombre, 2 doctor, 3 fecha/hora, 4 lugar | Hola {{1}}, te recordamos tu turno con {{2}} el {{3}} en {{4}}. Si no podés asistir, escribinos para liberar el horario. |
| `turno_cancelado` | 1 nombre, 2 doctor, 3 fecha/hora | Hola {{1}}, tu turno con {{2}} del {{3}} fue cancelado por el consultorio. Escribinos "hola" para reagendar. Disculpá las molestias. |
| `turno_reprogramado` | 1 nombre, 2 doctor, 3 fecha/hora anterior, 4 nueva fecha/hora, 5 lugar | Hola {{1}}, tu turno con {{2}} del {{3}} fue reprogramado para el {{4}} en {{5}}. Si no te sirve el horario, escribinos. |

La aprobación suele tardar de minutos a horas. El nombre de la plantilla que envía el
backend está en `backend/src/services/notifications.ts`; si usás otros nombres,
actualizalos ahí.

## 5. Activar el modo cloud

En `backend/.env`:

```env
WHATSAPP_MODE="cloud"
WHATSAPP_TOKEN="<token permanente>"
WHATSAPP_PHONE_NUMBER_ID="<phone number id>"
WHATSAPP_VERIFY_TOKEN="<tu secreto>"
WHATSAPP_API_VERSION="v21.0"
```

Reiniciá el backend. Desde ese momento:

- Los mensajes de los pacientes llegan por el webhook y el bot responde por la Cloud API.
- Las notificaciones salientes usan las plantillas aprobadas.

## 6. Checklist final

- [ ] El número aparece como "Conectado" en WhatsApp Manager.
- [ ] El webhook está verificado y suscripto a `messages`.
- [ ] Las 5 plantillas están **Aprobadas**.
- [ ] `GET https://TU-DOMINIO/health` responde `{"ok":true,"mode":"cloud"}`.
- [ ] Mandaste "hola" desde un celular real y el menú respondió.

## Costos (referencia)

- Conversaciones iniciadas por el paciente (servicio): sin costo.
- Plantillas utility (confirmación/recordatorio/cancelación): centavos de USD por
  mensaje, se facturan a la cuenta de Meta Business.
