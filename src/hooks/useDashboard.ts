import { useMemo } from 'react';
import {
  WEEKDAYS, addDays, dueLabel, formatLongDate, formatMinutes, isNightDim, minutesOf, quoteOfDay, timeToMinutes, toISODate, upcomingBirthdays,
  type UpcomingBirthday,
} from '../lib/dates';
import { buildWeek, displayedWeekStart, eventsOn, type CalendarDay } from '../lib/calendar';
import { orbPosition, phaseOf, skyOf, type Orb, type Phase, type Sky } from '../lib/sky';
import { weatherText } from '../services/weather';
import type { FamilyMember, Settings, Weather, WeatherKind, WidgetKey } from '../types';
import { useDatabase } from './useDatabase';
import { useHolidays } from './useHolidays';
import { useNow } from './useNow';
import { useWeather } from './useWeather';

export interface ActivityRow {
  id: string;
  time: string;
  icon: string;
  color: string;
  title: string;
  sub: string;
  state: 'past' | 'next' | 'later';
}

export interface TaskRow {
  id: string;
  title: string;
  done: boolean;
  high: boolean;
  member: FamilyMember | null;
  due: string;
}

export interface WeekDay extends CalendarDay {
  weather: { kind: WeatherKind; max: number } | null;
}

export interface MorningKid {
  member: FamilyMember;
  sandwich: string;
  bring: string;
  activity: string;
  task: string;
}

export interface DashboardModel {
  /** יום הולדת שחל היום: שמות החוגגים והגיל (כשיש חוגג אחד וגילו ידוע) */
  celebration: { names: string; age: number | null } | null;
  /** פריטים פתוחים ברשימת הקניות */
  shopping: string[];
  /** מסך היציאה מהבית; פעיל בבקרי הימים שנבחרו, עד קצת אחרי שעת היציאה */
  morning: { active: boolean; leaveIn: number; leaveAt: string; tip: string; kids: MorningKid[]; highlight: string };
  week: { label: string; range: string; days: WeekDay[] };
  familyName: string;
  settings: Settings;
  clock: string;
  dateText: string;
  minutes: number;
  dim: boolean;
  weather: Weather;
  phase: Phase;
  sky: Sky;
  orb: Orb;
  sandwiches: { dayLabel: string; rows: { member: FamilyMember; text: string }[] };
  meals: { lunch: string; dinner: string };
  activities: { title: string; rows: ActivityRow[] };
  tasks: TaskRow[];
  birthdays: UpcomingBirthday[];
  quote: string | null;
  photos: string[];
  show: (key: WidgetKey) => boolean;
}

/** פרמטרים לבדיקה בלבד: ‎?time=16:15&weather=rain&date=2026-10-07 */
function previewOverrides(): { minutes: number | null; weather: WeatherKind | null; date: string | null } {
  const query = new URLSearchParams(window.location.search);
  const time = query.get('time');
  const date = query.get('date');
  return {
    minutes: time && /^\d{1,2}:\d{2}$/.test(time) ? timeToMinutes(time) : null,
    weather: query.get('weather') as WeatherKind | null,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
  };
}

/** השעה שלפיה המסך מחושב: השעה האמיתית, או שעת הבדיקה מהכתובת. */
function effectiveNow(real: Date): { now: Date; preview: ReturnType<typeof previewOverrides> } {
  const preview = previewOverrides();
  const now = new Date(real);
  if (preview.date) {
    const [y, m, d] = preview.date.split('-').map(Number);
    now.setFullYear(y, m - 1, d);
  }
  if (preview.minutes !== null) now.setHours(Math.floor(preview.minutes / 60), preview.minutes % 60, 0, 0);
  return { now, preview };
}

/** אוסף את כל מה שהמסך צריך להציג ברגע הזה. */
export function useDashboard(): DashboardModel {
  const db = useDatabase();
  const realNow = useNow();
  const settings = db.settings[0];
  const liveWeather = useWeather(settings);
  const weekStart = displayedWeekStart(effectiveNow(realNow).now);
  const holidays = useHolidays(toISODate(weekStart), toISODate(addDays(weekStart, 6)), settings);

  return useMemo(() => {
    const { now, preview } = effectiveNow(realNow);
    const minutes = minutesOf(now);
    const weather: Weather = preview.weather ? { ...liveWeather, kind: preview.weather, text: weatherText(preview.weather) } : liveWeather;
    const phase = phaseOf(minutes, weather.sunrise, weather.sunset);
    const members = [...db.family_members].sort((a, b) => a.sortOrder - b.sortOrder);
    const memberById = new Map(members.map((m) => [m.id, m]));

    const today = toISODate(now);
    const tomorrowDate = addDays(now, 1);
    const tomorrow = toISODate(tomorrowDate);
    const mealText = (date: string, kind: 'lunch' | 'dinner') => db.meals.find((m) => m.date === date && m.kind === kind)?.text ?? '';

    const dayActivities = (weekday: number) =>
      db.activities.filter((a) => a.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime));
    let activityList = dayActivities(now.getDay());
    const showingToday = activityList.length > 0;
    if (!showingToday) activityList = dayActivities(tomorrowDate.getDay());
    const nextActivity = showingToday ? activityList.find((a) => timeToMinutes(a.endTime) > minutes) : undefined;

    const visible = new Map(settings.widgets.map((w) => [w.key, w.visible]));

    const birthdaysToday = upcomingBirthdays(members, db.birthdays, now, 99).filter((b) => b.days === 0);
    const calendarSources = { events: db.events, holidays, members, birthdays: db.birthdays, settings };

    // מצב בוקר
    const { morning } = settings;
    const from = timeToMinutes(morning.from);
    const leave = timeToMinutes(morning.leave);
    const forced = new URLSearchParams(window.location.search).get('mode') === 'morning';
    const morningActive = forced || (morning.enabled && morning.days.includes(now.getDay()) && minutes >= from && minutes < leave + 10);
    const tip =
      weather.kind === 'rain' ? '☔ יורד גשם: מעיל ומטרייה'
      : weather.kind === 'snow' ? '🧤 שלג! מעיל, כובע וכפפות'
      : weather.temp <= 15 ? '🧥 קר הבוקר: מעיל'
      : weather.temp <= 22 ? '🧶 קריר: כדאי סוודר'
      : '🧢 חם היום: כובע ובקבוק מים';
    const todayActivities = dayActivities(now.getDay());
    const morningKids: MorningKid[] = members.filter((m) => m.getsSandwich).map((member) => {
      const mine = todayActivities.filter((a) => a.memberId === member.id);
      const task = db.tasks.find((t) => t.memberId === member.id && !t.done && (!t.dueDate || t.dueDate <= today));
      return {
        member,
        sandwich: db.meals.find((m) => m.date === today && m.kind === 'sandwich' && m.memberId === member.id)?.text ?? '',
        bring: [...new Set(mine.map((a) => a.bring).filter(Boolean))].join(', '),
        activity: mine[0] ? `${mine[0].startTime} · ${mine[0].title}` : '',
        task: task?.title ?? '',
      };
    });

    return {
      familyName: db.families[0]?.name ?? '',
      settings,
      clock: formatMinutes(minutes),
      dateText: formatLongDate(now),
      minutes,
      dim: preview.minutes === null && isNightDim(settings, minutes),
      celebration: birthdaysToday.length
        ? { names: birthdaysToday.map((b) => b.name).join(' ו'), age: birthdaysToday.length === 1 ? birthdaysToday[0].age : null }
        : null,
      shopping: db.shopping_items.filter((i) => !i.done).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((i) => i.text),
      morning: {
        active: morningActive,
        leaveIn: leave - minutes,
        leaveAt: morning.leave,
        tip,
        kids: morningKids,
        highlight: eventsOn(today, calendarSources)[0]?.title ?? '',
      },
      week: {
        label: toISODate(weekStart) > toISODate(now) ? 'השבוע הבא' : 'השבוע',
        range: `${weekStart.getDate()}.${weekStart.getMonth() + 1}–${addDays(weekStart, 6).getDate()}.${addDays(weekStart, 6).getMonth() + 1}`,
        days: buildWeek(now, calendarSources).map((day) => {
          const forecast = day.offset < 0 ? undefined : weather.forecast.find((f) => f.date === day.date);
          const today = day.offset === 0 && weather.live ? { kind: weather.kind, max: weather.temp } : null;
          return { ...day, weather: today ?? (forecast ? { kind: forecast.kind, max: forecast.max } : null) };
        }),
      },
      weather,
      phase,
      sky: skyOf(phase, weather.kind),
      orb: orbPosition(minutes, weather.sunrise, weather.sunset),
      sandwiches: {
        dayLabel: `יום ${WEEKDAYS[tomorrowDate.getDay()]}`,
        rows: members
          .filter((m) => m.getsSandwich)
          .map((member) => ({ member, text: db.meals.find((m) => m.date === tomorrow && m.kind === 'sandwich' && m.memberId === member.id)?.text ?? '' }))
          .filter((row) => row.text),
      },
      meals: { lunch: mealText(today, 'lunch'), dinner: mealText(today, 'dinner') },
      activities: {
        title: showingToday || !activityList.length ? 'חוגים היום' : 'חוגים מחר',
        rows: activityList.map((a) => {
          const member = memberById.get(a.memberId);
          return {
            id: a.id,
            time: a.startTime,
            icon: a.icon,
            color: member?.color ?? '#888',
            title: `${member?.name ?? ''} · ${a.title}`,
            sub: `עד ${a.endTime}${a.place ? ` · ${a.place}` : ''}`,
            state: !showingToday ? 'later' : timeToMinutes(a.endTime) <= minutes ? 'past' : a === nextActivity ? 'next' : 'later',
          };
        }),
      },
      tasks: db.tasks
        .filter((t) => !t.done || t.completedAt?.slice(0, 10) === now.toISOString().slice(0, 10))
        .sort((a, b) => Number(a.done) - Number(b.done) || Number(b.priority === 'high') - Number(a.priority === 'high') || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'))
        .slice(0, 5)
        .map((t) => ({ id: t.id, title: t.title, done: t.done, high: t.priority === 'high', member: t.memberId ? memberById.get(t.memberId) ?? null : null, due: dueLabel(t.dueDate, now) })),
      birthdays: upcomingBirthdays(members, db.birthdays, now),
      quote: quoteOfDay(db.daily_quotes, now),
      photos: db.photos.map((p) => p.url),
      show: (key) => visible.get(key) ?? true,
    };
  }, [db, realNow, liveWeather, settings, holidays, weekStart.getTime()]);
}
