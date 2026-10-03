import type { ISODate } from '../types';

export interface Holiday {
  date: ISODate;
  title: string;
}

/** ספק חגים ומועדים. כדי לעבור למקור אחר מממשים את הממשק הזה. */
export interface HolidayProvider {
  fetch(start: ISODate, end: ISODate): Promise<Holiday[]>;
}

interface HebcalResponse {
  items?: { title: string; hebrew?: string; date: string; category: string }[];
}

/** Hebcal: לוח עברי חינמי, בלי מפתח. מבקשים חגים לפי מנהג ישראל, בעברית. */
export const hebcal: HolidayProvider = {
  async fetch(start, end) {
    const params = new URLSearchParams({ v: '1', cfg: 'json', maj: 'on', min: 'on', mod: 'on', nx: 'off', ss: 'off', mf: 'off', c: 'off', s: 'off', i: 'on', lg: 'he-x-NoNikud', start, end });
    const response = await fetch(`https://www.hebcal.com/hebcal?${params}`);
    if (!response.ok) throw new Error(`Hebcal ${response.status}`);
    const data = (await response.json()) as HebcalResponse;
    return (data.items ?? [])
      .filter((item) => item.category === 'holiday')
      .map((item) => ({ date: item.date.slice(0, 10), title: item.title }));
  },
};

export const holidayProvider: HolidayProvider = hebcal;
