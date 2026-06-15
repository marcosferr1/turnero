import { AsyncLocalStorage } from "node:async_hooks";

/** Contexto de una conversación bot: un paciente hablando con un doctor vía su número de WhatsApp. */
export interface BotContext {
  doctorId: number;
  doctorName: string;
  doctorSpecialty: string;
  patientPhone: string;
  /** JID de WhatsApp del paciente (Baileys: necesario si el remitente usa @lid). */
  patientJid?: string;
  /** phone_number_id de Meta para enviar respuestas desde el mismo número. */
  phoneNumberId: string;
}

export const botContext = new AsyncLocalStorage<BotContext>();

export function getBotContext(): BotContext {
  const ctx = botContext.getStore();
  if (!ctx) throw new Error("Contexto del bot no inicializado");
  return ctx;
}

export function runWithBotContext<T>(ctx: BotContext, fn: () => Promise<T>): Promise<T> {
  return botContext.run(ctx, fn);
}
