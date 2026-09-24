export function classStatus(item: { fecha_inicio: string; fecha_fin: string; cupos_disponibles: number }, now: number) {
  if (Date.parse(item.fecha_fin) <= now) return { code: 'FIN', description: 'Clase finalizada', disabled: true };
  if (Date.parse(item.fecha_inicio) <= now) return { code: 'ONGOING', description: 'En curso', disabled: true };
  if (item.cupos_disponibles <= 0) return { code: 'FULL', description: 'Sin cupos', disabled: true };
  return { code: 'OPEN', description: 'Reservas abiertas', disabled: false };
}
