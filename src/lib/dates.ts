import type { Birthday, DailyQuote, FamilyMember, ISODate, Settings, Time } from '../types';

export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const pad = (n: number) => String(n).padStart(2, '0');

export const toISODate = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const addDays = (d: Date, days: number): Date => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

export const minutesOf = (d: Date): number => d.getHours() * 60 + d.getMinutes();
export const timeToMinutes = (t: Time): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const formatMinutes = (m: number): Time => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

export const formatLongDate = (d: Date): string =>
  new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export interface UpcomingBirthday {
  id: string;
  name: string;
  color: string;
  days: number;
  /** הגיל שיחגגו; null כששנת הלידה לא ידועה */
  age: number | null;
  longDate: string;
  shortDate: string;
}

/** ימי ההולדת הקרובים: בני המשפחה + אנשים נוספים, ממוינים מהקרוב לרחוק. */
export function upcomingBirthdays(members: FamilyMember[], extra: Birthday[], today: Date, limit = 3): UpcomingBirthday[] {
  const people = [
    ...members.filter((m) => m.birthDate).map((m) => ({ id: m.id, name: m.name, color: m.color, birthDate: m.birthDate!, yearKnown: true })),
    ...extra.map((b) => ({ id: b.id, name: b.name, color: b.color, birthDate: b.birthDate, yearKnown: b.yearKnown })),
  ];
  const base = startOfDay(today);
  return people
    .map((p) => {
      const [year, month, day] = p.birthDate.split('-').map(Number);
      let next = new Date(base.getFullYear(), month - 1, day);
      if (next < base) next = new Date(base.getFullYear() + 1, month - 1, day);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        days: Math.round((next.getTime() - base.getTime()) / 864e5),
        age: p.yearKnown ? next.getFullYear() - year : null,
        longDate: new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long' }).format(next),
        shortDate: `${day}.${month}`,
      };
    })
    .sort((a, b) => a.days - b.days)
    .slice(0, limit);
}

/** משפט היום: משפט שנקבע לתאריך, ואם אין - בחירה קבועה ליום מתוך המאגר הפעיל. */
export function quoteOfDay(quotes: DailyQuote[], today: Date): string | null {
  const iso = toISODate(today);
  const pinned = quotes.find((q) => q.date === iso);
  if (pinned) return pinned.text;
  const pool = quotes.filter((q) => q.active && !q.date);
  if (!pool.length) return null;
  const dayIndex = Math.floor(startOfDay(today).getTime() / 864e5);
  return pool[dayIndex % pool.length].text;
}

/** האם השעה בתוך חלון הלילה המעומעם (החלון יכול לחצות חצות). */
export function isNightDim(settings: Settings, minutes: number): boolean {
  if (!settings.nightDim.enabled) return false;
  const from = timeToMinutes(settings.nightDim.from);
  const to = timeToMinutes(settings.nightDim.to);
  return from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

export function dueLabel(due: ISODate | null, today: Date): string {
  if (!due) return '';
  const [y, m, d] = due.split('-').map(Number);
  const diff = Math.round((new Date(y, m - 1, d).getTime() - startOfDay(today).getTime()) / 864e5);
  if (diff < 0) return 'באיחור';
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff < 7) return `יום ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`;
  return `${d}.${m}`;
}
