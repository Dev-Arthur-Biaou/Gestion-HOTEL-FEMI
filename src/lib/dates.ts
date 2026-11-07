export const HOTEL_TZ = "Africa/Porto-Novo";

/** Date du jour au Bénin, au format YYYY-MM-DD (indépendante du fuseau du navigateur). */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "");
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Nombre de nuits = différence de dates calendaires (départ strictement après l'arrivée). */
export function nightsBetween(arrival: string, departure: string): number {
  if (!isISODate(arrival) || !isISODate(departure)) return 0;
  const a = Date.parse(`${arrival}T00:00:00Z`);
  const b = Date.parse(`${departure}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function frDate(iso: string, style: "short" | "long" | "medium" = "medium"): string {
  if (!isISODate(iso)) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  const options: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
      : style === "short"
        ? { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }
        : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat("fr-FR", options).format(d);
}

export function frDayMonth(iso: string): string {
  if (!isISODate(iso)) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function frDateTime(iso: string, time: string): string {
  return `${frDate(iso)} · ${time || "—"}`;
}

export function frTimestamp(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: HOTEL_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function relativeDay(iso: string, today = todayISO()): string {
  const diff = nightsBetween(today, iso);
  if (iso === today) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff > 1) return `Dans ${diff} jours`;
  const past = nightsBetween(iso, today);
  if (past === 1) return "Hier";
  return `Il y a ${past} jours`;
}
