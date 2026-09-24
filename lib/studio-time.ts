export const STUDIO_TIME_ZONE = "America/La_Paz";
export const STUDIO_UTC_OFFSET = "-04:00";

const studioDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: STUDIO_TIME_ZONE,
  year: "numeric",
});

const studioTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: STUDIO_TIME_ZONE,
});

export function studioDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(
    studioDateFormatter
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: partValue }) => [type, partValue]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function studioTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "" : studioTimeFormatter.format(date);
}

/**
 * Día de la semana (0=domingo) en la zona del estudio.
 * Usar getUTCDay() directamente descoloca las clases de la noche, porque una
 * clase de 20:15 en La Paz se guarda como 00:15 UTC del día siguiente.
 */
export function studioWeekday(value: Date | string) {
  const key = studioDateKey(value);
  return key ? new Date(`${key}T12:00:00Z`).getUTCDay() : NaN;
}

/** Suma días a una clave `YYYY-MM-DD` sin salirse del calendario del estudio. */
export function studioAddDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Lunes de la semana a la que pertenece la fecha. */
export function studioWeekStart(dateKey: string) {
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return studioAddDays(dateKey, weekday === 0 ? -6 : 1 - weekday);
}

export function studioDateTimeIso(dateKey: string, time: string, endOfDay = false) {
  const normalizedTime = endOfDay ? "23:59:59" : `${time}:00`;
  return new Date(`${dateKey}T${normalizedTime}${STUDIO_UTC_OFFSET}`).toISOString();
}
