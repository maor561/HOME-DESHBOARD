import { useEffect, useState } from 'react';
import { holidayProvider, type Holiday } from '../services/holidays';
import type { ISODate, Settings } from '../types';

const CACHE_KEY = 'cohen-dashboard-holidays-v2';
const MAX_AGE_MS = 24 * 60 * 60_000;

function readCache(key: string): { items: Holiday[]; fresh: boolean } {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { key: string; at: number; items: Holiday[] } | null;
    if (cached?.key !== key) return { items: [], fresh: false };
    return { items: cached.items, fresh: Date.now() - cached.at < MAX_AGE_MS };
  } catch {
    return { items: [], fresh: false };
  }
}

/**
 * חגים, מועדים וזמני שבת בטווח התאריכים, למיקום שבהגדרות.
 * נשמרים במטמון כדי שיופיעו גם בלי רשת, ונטענים מחדש לכל היותר פעם ביממה.
 */
export function useHolidays(start: ISODate, end: ISODate, settings: Settings): Holiday[] {
  const enabled = settings.calendar.holidays || settings.calendar.shabbat;
  const { latitude, longitude } = settings;
  const key = `${start}:${end}:${latitude},${longitude}`;
  const [holidays, setHolidays] = useState<Holiday[]>(() => readCache(key).items);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const cached = readCache(key);
    setHolidays(cached.items);
    // אותו שבוע כבר נטען ביממה האחרונה: אין צורך בבקשה נוספת
    if (cached.fresh) return;
    holidayProvider
      .fetch({ start, end, latitude, longitude })
      .then((items) => {
        if (cancelled) return;
        setHolidays(items);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ key, at: Date.now(), items }));
      })
      .catch((error) => console.warn('טעינת החגים נכשלה', error));
    return () => {
      cancelled = true;
    };
  }, [key, start, end, latitude, longitude, enabled]);

  return enabled ? holidays : [];
}
