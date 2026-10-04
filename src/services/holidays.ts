import type { ISODate } from '../types';

export interface Holiday {
  date: ISODate;
  title: string;
  /** holiday = חג או מועד; candles = כניסת שבת או חג; havdalah = צאת שבת או חג */
  kind: 'holiday' | 'candles' | 'havdalah';
}

export interface HolidayQuery {
  start: ISODate;
  end: ISODate;
  latitude: number;
  longitude: number;
}

/** ספק חגים ומועדים. כדי לעבור למקור אחר מממשים את הממשק הזה. */
export interface HolidayProvider {
  fetch(query: HolidayQuery): Promise<Holiday[]>;
}

interface HebcalResponse {
  items?: { title: string; date: string; category: string }[];
}

/**
 * Hebcal: לוח עברי חינמי, בלי מפתח. מבקשים חגים לפי מנהג ישראל, בעברית,
 * וזמני הדלקת נרות והבדלה לפי המיקום שבהגדרות.
 */
export const hebcal: HolidayProvider = {
  async fetch({ start, end, latitude, longitude }) {
    const params = new URLSearchParams({
      v: '1', cfg: 'json', maj: 'on', min: 'on', mod: 'on', nx: 'off', ss: 'off', mf: 'off', s: 'off', i: 'on', lg: 'he-x-NoNikud',
      c: 'on', M: 'on', geo: 'pos', latitude: String(latitude), longitude: String(longitude),
      tzid: Intl.DateTimeFormat().resolvedOptions().timeZone,
      start, end,
    });
    const response = await fetch(`https://www.hebcal.com/hebcal?${params}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Hebcal ${response.status}`);
    const data = (await response.json()) as HebcalResponse;
    const result: Holiday[] = [];
    for (const item of data.items ?? []) {
      const date = item.date.slice(0, 10);
      // בזמני שבת התאריך מגיע עם שעה מקומית: 2026-10-09T17:54:00+03:00
      const time = item.date.slice(11, 16);
      const [y, m, d] = date.split('-').map(Number);
      const weekday = new Date(y, m - 1, d).getDay();
      if (item.category === 'holiday') result.push({ date, title: item.title, kind: 'holiday' });
      else if (item.category === 'candles') result.push({ date, title: `🕯️ ${weekday === 5 ? 'כניסת שבת' : 'הדלקת נרות'} ${time}`, kind: 'candles' });
      else if (item.category === 'havdalah') result.push({ date, title: `✨ ${weekday === 6 ? 'צאת שבת' : 'צאת החג'} ${time}`, kind: 'havdalah' });
    }
    return result;
  },
};

export const holidayProvider: HolidayProvider = hebcal;
