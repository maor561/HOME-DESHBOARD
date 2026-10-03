import { useEffect, useState } from 'react';
import { holidayProvider, type Holiday } from '../services/holidays';
import type { ISODate } from '../types';

const CACHE_KEY = 'cohen-dashboard-holidays-v1';

function readCache(range: string): Holiday[] {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { range: string; items: Holiday[] } | null;
    return cached?.range === range ? cached.items : [];
  } catch {
    return [];
  }
}

/** חגים ומועדים בטווח התאריכים. נשמרים במטמון כדי שיופיעו גם בלי רשת. */
export function useHolidays(start: ISODate, end: ISODate, enabled: boolean): Holiday[] {
  const range = `${start}:${end}`;
  const [holidays, setHolidays] = useState<Holiday[]>(() => readCache(range));

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setHolidays(readCache(range));
    holidayProvider
      .fetch(start, end)
      .then((items) => {
        if (cancelled) return;
        setHolidays(items);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ range, items }));
      })
      .catch((error) => console.warn('טעינת החגים נכשלה', error));
    return () => {
      cancelled = true;
    };
  }, [range, start, end, enabled]);

  return enabled ? holidays : [];
}
