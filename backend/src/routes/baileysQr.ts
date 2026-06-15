import { Router } from "express";
import QRCode from "qrcode";
import { config } from "../config";
import { getBaileysPairingState } from "../bot/baileys";

export const baileysQrRouter = Router();

function pairingPage(title: string, body: string, refreshSeconds?: number): string {
  const refresh = refreshSeconds
    ? `<meta http-equiv="refresh" content="${refreshSeconds}">`
    : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${refresh}
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 28rem; margin: 2rem auto; padding: 0 1rem; text-align: center; }
    h1 { font-size: 1.25rem; }
    p { color: #444; line-height: 1.5; }
    svg { width: min(100%, 320px); height: auto; margin: 1rem auto; display: block; }
    .hint { font-size: 0.875rem; color: #666; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${body}
</body>
</html>`;
}

baileysQrRouter.get("/baileys/qr", async (req, res) => {
  if (config.whatsapp.mode !== "baileys") {
    res.status(404).send(pairingPage("Baileys desactivado", "<p>WHATSAPP_MODE no es baileys.</p>"));
    return;
  }

  if (config.baileys.qrSecret && req.query.token !== config.baileys.qrSecret) {
    res.status(401).send(pairingPage("No autorizado", "<p>Token inválido o faltante.</p>"));
    return;
  }

  const { qr, connected } = getBaileysPairingState();

  if (connected) {
    res.send(
      pairingPage(
        "WhatsApp conectado",
        `<p>La sesión Baileys ya está vinculada (+${config.baileys.phone}).</p>`,
      ),
    );
    return;
  }

  if (!qr) {
    res.send(
      pairingPage(
        "Esperando QR…",
        `<p>El servidor está generando el código. Esta página se actualiza sola.</p>
         <p class="hint">WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>`,
        3,
      ),
    );
    return;
  }

  const svg = await QRCode.toString(qr, { type: "svg", margin: 2, width: 320 });
  res.send(
    pairingPage(
      "Vincular WhatsApp",
      `<p>Escaneá con WhatsApp → <strong>Dispositivos vinculados</strong></p>
       ${svg}
       <p class="hint">El código se renueva cada ~20 s. Refrescá si expira.</p>`,
      15,
    ),
  );
});
