function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function pickGreeting(doctorName: string, doctorSpecialty: string): string {
  const variants = [
    `¡Hola! Soy el asistente de *${doctorName}* (${doctorSpecialty}).\n` +
      "Por acá podés consultar información, ver disponibilidad y pedir turnos.",
    `¡Buen día! Te escribe el asistente virtual de *${doctorName}* (${doctorSpecialty}).\n` +
      "Acá podés ver horarios, pedir turnos y consultar información útil.",
    `Hola, ¿cómo estás? Soy el bot de *${doctorName}* (${doctorSpecialty}).\n` +
      "Te ayudo con turnos, disponibilidad e información del consultorio.",
    `¡Hola! Estoy para ayudarte con *${doctorName}* (${doctorSpecialty}).\n` +
      "Podés ver lugares de atención, horarios libres y agendar un turno.",
    `Bienvenido/a. Soy el asistente de *${doctorName}* (${doctorSpecialty}).\n` +
      "Desde acá podés consultar info, revisar disponibilidad y solicitar turnos.",
    `Hola 👋 Soy el asistente de *${doctorName}* (${doctorSpecialty}).\n` +
      "Contame si querés info, ver horarios o pedir un turno.",
  ];
  return pickRandom(variants);
}

export function pickMenuPrompt(): string {
  return pickRandom([
    "¿Qué necesitás hacer?",
    "¿En qué te puedo ayudar?",
    "Elegí una opción:",
  ]);
}
