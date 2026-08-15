/**
 * Display formatting. Every formatter pins its locale rather than using the
 * runtime default: the server and the browser run in different locales and
 * timezones, and an unpinned Intl call renders two different strings for the
 * same value — which Vue reports as a hydration mismatch.
 */

// timeZone matters as much as locale here. dueDate and workedOn are date-only
// strings with no zone, and a timestamp near midnight UTC lands on a different
// calendar day for a browser in Manila than for the server rendering it.
//
// ponytail: UTC for everyone. A desk billing across timezones wants the user's
// own zone — send it up as a preference and pass it in here when that day comes.
const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});
const relFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// Constructing an Intl.NumberFormat is expensive and an invoice renders one per
// line, so they are built once per currency.
const moneyFmts = new Map<string, Intl.NumberFormat>();

export function money(minor: number, currency: string): string {
  const major = minor / 100;
  let fmt = moneyFmts.get(currency);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat("en-US", { style: "currency", currency });
    } catch {
      // Intl throws on a currency code it does not recognise, and currency is
      // user-supplied data. A plain number beats a 500.
      return `${currency} ${major.toFixed(2)}`;
    }
    moneyFmts.set(currency, fmt);
  }
  return fmt.format(major);
}

export function hours(minutes: number): string {
  const whole = Math.trunc(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  if (!whole) return `${sign}${rest}m`;
  return rest ? `${sign}${whole}h ${rest}m` : `${sign}${whole}h`;
}

export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFmt.format(date);
}

// Each pair is [unit, how many of it make the next unit up].
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.348],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY]
];

export function relativeDate(iso: string): string {
  const ms = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).getTime();
  if (Number.isNaN(ms)) return "—";

  let value = (ms - Date.now()) / 1000;
  for (const [unit, perNext] of STEPS) {
    if (Math.abs(value) < perNext) return relFmt.format(Math.round(value), unit);
    value /= perNext;
  }
  return relFmt.format(Math.round(value), "year");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0]![0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function statusLabel(s: string): string {
  const words = s.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
