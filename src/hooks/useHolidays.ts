import { useEffect, useState } from 'react';
import { holidayProvider, type Holiday } from '../services/holidays';
import type { ISODate } from '../types';

const CACHE_KEY = 'cohen-dashboard-holidays-v1';

const MAX_AGE_MS = 24 * 60 * 60_000;

function readCache(range: string): { items: Holiday[]; fresh: boolean } {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { range: string; at?: number; items: Holiday[] } | null;
    if (cached?.range !== range) return { items: [], fresh: false };
    return { items: cached.items, fresh: Date.now() - (cached.at ?? 0) < MAX_AGE_MS };
  } catch {
    return { items: [], fresh: false };
  }
}

/** חגים ומועדים בטווח התאריכים. נשמרים במטמון כדי שיופיעו גם בלי רשת. */
export function useHolidays(start: ISODate, end: ISODate, enabled: boolean): Holiday[] {
  const range = `${start}:${end}`;
  const [holidays, setHolidays] = useState<Holiday[]>(() => readCache(range).items);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const cached = readCache(range);
    setHolidays(cached.items);
    // אותו שבוע כבר נטען ביממה האחרונה: אין צורך בבקשה נוספת
    if (cached.fresh) return;
    holidayProvider
      .fetch(start, end)
      .then((items) => {
        if (cancelled) return;
        setHolidays(items);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ range, at: Date.now(), items }));
      })
      .catch((error) => console.warn('טעינת החגים נכשלה', error));
    return () => {
      cancelled = true;
    };
  }, [range, start, end, enabled]);

  return enabled ? holidays : [];
}
