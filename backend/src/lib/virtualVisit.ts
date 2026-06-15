const VIRTUAL_MEET_NOTICE =
  "\n\n📹 *Consulta virtual*\n" +
  "El enlace de Google Meet te lo enviaremos por *Gmail* aproximadamente *1 hora antes* del turno.";

export function isVirtualAppointment(location: { isVirtualVisit: boolean }): boolean {
  return location.isVirtualVisit;
}

export function virtualMeetNotice(location: { isVirtualVisit: boolean }): string {
  return isVirtualAppointment(location) ? VIRTUAL_MEET_NOTICE : "";
}
