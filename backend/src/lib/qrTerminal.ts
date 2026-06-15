/* eslint-disable @typescript-eslint/no-require-imports */
const QRCode = require("qrcode-terminal/vendor/QRCode");
const QRErrorCorrectLevel = require("qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel");

/** QR en ASCII (# / espacio) legible en logs cloud (Railway, etc.). */
export function renderQrForLogs(data: string): string {
  const qr = new QRCode(-1, QRErrorCorrectLevel.L);
  qr.addData(data);
  qr.make();

  const modules: boolean[][] = qr.modules;
  const size = qr.getModuleCount();
  const border = "#".repeat(size + 4);
  const lines = [border];

  for (const row of modules) {
    lines.push(`##${row.map((cell) => (cell ? "#" : " ")).join("")}##`);
  }

  lines.push(border);
  return lines.join("\n");
}

export function logQrForCloud(data: string, label: string): void {
  const block = renderQrForLogs(data);
  console.log(`${label}\n\n${block}\n`);
}
