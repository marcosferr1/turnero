import { prisma } from "../prisma";

const CSW_MS = 24 * 60 * 60 * 1000;

/** Ventana de atención WhatsApp: 24 hs desde el último mensaje del paciente. */
export async function isWhatsAppCustomerWindowOpen(
  phone: string,
  doctorId: number
): Promise<boolean> {
  const since = new Date(Date.now() - CSW_MS);
  const lastIn = await prisma.messageLog.findFirst({
    where: { phone, doctorId, direction: "IN", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  return lastIn != null;
}
