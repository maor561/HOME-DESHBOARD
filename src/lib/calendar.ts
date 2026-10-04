import { FUN_DAYS } from '../data/funDays';
import type { Holiday } from '../services/holidays';
import type { Birthday, CalendarEvent, FamilyMember, ISODate, Settings } from '../types';
import { WEEKDAYS, addDays, minutesOf, toISODate } from './dates';

export type DayEventKind = 'holiday' | 'shabbat' | 'vacation' | 'fun' | 'family' | 'birthday';

export interface DayEvent {
  /** מזהה יציב: לאירוע אוטומטי משמש להסתרה, לאירוע של המשפחה זה מזהה השורה */
  key: string;
  title: string;
  kind: DayEventKind;
  /** אירוע שנכנס אוטומטית (חג או יום מיוחד) ולא נשמר במסד הנתונים */
  auto: boolean;
}

export interface CalendarDay {
  date: ISODate;
  name: string;
  shortDate: string;
  /** מרחק בימים מהיום: שלילי = עבר, 0 = היום */
  offset: number;
  events: DayEvent[];
}

export interface CalendarSources {
  events: CalendarEvent[];
  holidays: Holiday[];
  members: FamilyMember[];
  birthdays: Birthday[];
  settings: Settings;
}

export const EVENT_COLOR: Record<DayEventKind, string> = { shabbat: '#5b6bb5', holiday: '#c98a1a', vacation: '#2f9e7a', fun: '#d9567f', family: '#3f8fdc', birthday: '#8a63d2' };
export const EVENT_LABEL: Record<DayEventKind, string> = { shabbat: 'שבת', holiday: 'חג', vacation: 'חופשה', fun: 'יום מיוחד', family: 'שלנו', birthday: 'יום הולדת' };

/** שעת המעבר לשבוע הבא ביום שבת */
const WEEK_SWITCH_MINUTES = 18 * 60;

/** יום ראשון של השבוע המוצג. בשבת מ-18:00 מוצג כבר השבוע הבא. */
export function displayedWeekStart(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  return now.getDay() === 6 && minutesOf(now) >= WEEK_SWITCH_MINUTES ? addDays(start, 7) : start;
}

function occursOn(event: CalendarEvent, date: ISODate): boolean {
  if (event.yearly) return event.date.slice(5) === date.slice(5);
  return date >= event.date && date <= (event.endDate ?? event.date);
}

/** כל האירועים של יום אחד. includeHidden מחזיר גם אירועים אוטומטיים שהוסתרו (למסך הניהול). */
export function eventsOn(date: ISODate, sources: CalendarSources, includeHidden = false): DayEvent[] {
  const { settings } = sources;
  const hidden = new Set(settings.calendar.hidden);
  const list: DayEvent[] = [];

  const today = sources.holidays.filter((h) => h.date === date);
  if (settings.calendar.holidays) {
    today.filter((h) => h.kind === 'holiday').forEach((h) => list.push({ key: `holiday:${date}:${h.title}`, title: h.title, kind: 'holiday', auto: true }));
  }
  if (settings.calendar.shabbat) {
    today.filter((h) => h.kind !== 'holiday').forEach((h) => list.push({ key: `shabbat:${date}:${h.kind}`, title: h.title, kind: 'shabbat', auto: true }));
  }
  sources.events
    .filter((e) => e.kind === 'vacation' && occursOn(e, date))
    .forEach((e) => list.push({ key: e.id, title: `${e.icon} ${e.title}`, kind: 'vacation', auto: false }));
  [...sources.members.filter((m) => m.birthDate).map((m) => ({ id: m.id, name: m.name, birthDate: m.birthDate! })), ...sources.birthdays]
    .filter((p) => p.birthDate.slice(5) === date.slice(5))
    .forEach((p) => list.push({ key: `birthday:${p.id}`, title: `🎂 יום הולדת ל${p.name}`, kind: 'birthday', auto: true }));
  sources.events
    .filter((e) => e.kind === 'family' && occursOn(e, date))
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    .forEach((e) => list.push({ key: e.id, title: `${e.icon} ${e.title}${e.time ? ` · ${e.time}` : ''}`, kind: 'family', auto: false }));
  sources.events
    .filter((e) => e.kind === 'fun' && occursOn(e, date))
    .forEach((e) => list.push({ key: e.id, title: `${e.icon} ${e.title}`, kind: 'fun', auto: false }));
  if (settings.calendar.funDays) {
    FUN_DAYS.filter(([day]) => day === date.slice(5)).forEach(([day, title]) => list.push({ key: `fun:${day}:${title}`, title, kind: 'fun', auto: true }));
  }

  return includeHidden ? list : list.filter((e) => !hidden.has(e.key));
}

/** שבעת ימי השבוע המוצג, מראשון עד שבת. */
export function buildWeek(now: Date, sources: CalendarSources, includeHidden = false): CalendarDay[] {
  const start = displayedWeekStart(now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    const date = toISODate(day);
    return {
      date,
      name: WEEKDAYS[i],
      shortDate: `${day.getDate()}.${day.getMonth() + 1}`,
      offset: Math.round((day.getTime() - today.getTime()) / 864e5),
      events: eventsOn(date, sources, includeHidden),
    };
  });
}
