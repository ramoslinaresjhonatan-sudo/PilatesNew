export function eventStatus(event: { estado: string; fecha_inicio: string; fecha_fin: string }, now: number) {
  if (event.estado === 'CANCELADA' || event.estado === 'BORRADOR') return event.estado;
  if (event.estado === 'FINALIZADA' || Date.parse(event.fecha_fin) <= now) return 'FINALIZADA';
  return Date.parse(event.fecha_inicio) <= now ? 'EN_CURSO' : 'PUBLICADA';
}
