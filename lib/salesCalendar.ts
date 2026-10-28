// The big selling days (Black Friday, Christmas, Valentine's...) shared
// by the dashboard's sales-date cards and the sales page countdown. No
// imports on purpose: the sales page uses this too, and shouldn't pull
// in Firebase.

export interface SalesDate {
  /** Stable id, e.g. "black-friday". Matches the catalog id where one
   * exists (lib/templates/catalog.ts). */
  id: string;
  name: string;
  date: Date;
  days: number;
}

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

/** Easter Sunday (Western), the Anonymous Gregorian algorithm. */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

// Sales days that have their own campaign template (same id as the catalog).
const OWN_TEMPLATE = new Set(["black-friday", "cyber-monday", "xmas-holidays", "valentines-day"]);

/** Which campaign template "Plan it" opens for a sales day. The big ones
 * have their own; the rest (Easter, Mother's Day...) use the Holiday Sale
 * template, which is a clear start-and-end deal. Never the webinar default. */
export function templateForSale(saleId: string): string {
  return OWN_TEMPLATE.has(saleId) ? saleId : "holiday-sale";
}

/** The sales calendar: every big selling day, in date order, from
 * tomorrow on. */
export function salesCalendar(now: Date): SalesDate[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dates: Omit<SalesDate, "days">[] = [];
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
    const bf = nthWeekday(y, 10, 4, 4);
    bf.setDate(bf.getDate() + 1); // the Friday after the 4th Thursday
    dates.push(
      { id: "new-year", name: "New Year", date: new Date(y, 0, 1) },
      { id: "valentines-day", name: "Valentine's Day", date: new Date(y, 1, 14) },
      { id: "easter", name: "Easter", date: easter(y) },
      { id: "mothers-day", name: "Mother's Day", date: nthWeekday(y, 4, 0, 2) },
      { id: "fathers-day", name: "Father's Day", date: nthWeekday(y, 5, 0, 3) },
      { id: "black-friday", name: "Black Friday", date: bf },
      { id: "cyber-monday", name: "Cyber Monday", date: new Date(bf.getFullYear(), bf.getMonth(), bf.getDate() + 3) },
      { id: "xmas-holidays", name: "Christmas", date: new Date(y, 11, 25) }
    );
  }
  return dates
    .map((d) => ({ ...d, days: Math.round((d.date.getTime() - today.getTime()) / 86400000) }))
    .filter((d) => d.days >= 1)
    .sort((a, b) => a.days - b.days);
}

/**
 * The sales dates to show on the dashboard: the next one (if it's within
 * 60 days), plus any that follow it closely (each within 14 days of the
 * one before), so Black Friday and Cyber Monday show together, and
 * Christmas and New Year do too. At most 3.
 */
export function upcomingSalesDates(now: Date): SalesDate[] {
  const all = salesCalendar(now);
  if (!all.length || all[0].days > 60) return [];
  const out = [all[0]];
  for (const d of all.slice(1)) {
    if (out.length >= 3 || d.days - out[out.length - 1].days > 14) break;
    out.push(d);
  }
  return out;
}

