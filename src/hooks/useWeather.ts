import { useEffect, useState } from 'react';
import { fallbackWeather, weatherProvider } from '../services/weather';
import type { Settings, Weather } from '../types';

const REFRESH_MS = 15 * 60_000;
const CACHE_KEY = 'cohen-dashboard-weather-v1';

interface Cached {
  key: string;
  at: number;
  weather: Weather;
}

function readCache(key: string): Cached | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Cached | null;
    return cached?.key === key ? cached : null;
  } catch {
    return null;
  }
}

/**
 * מזג אוויר חי למיקום שבהגדרות. מתרענן כל רבע שעה, רק כשהמסך גלוי.
 * התשובה האחרונה נשמרת בדפדפן, כך שרענון של העמוד לא מושך שוב לפני שעבר רבע שעה.
 */
export function useWeather(settings: Settings): Weather {
  const { latitude, longitude, units } = settings;
  const key = `${latitude},${longitude},${units}`;
  const [weather, setWeather] = useState<Weather>(() => readCache(key)?.weather ?? fallbackWeather());

  useEffect(() => {
    let cancelled = false;

    const load = (initial = false) => {
      // הטעינה הראשונה תמיד רצה; הרענונים התקופתיים רק כשהמסך גלוי
      if (document.hidden && !initial) return;
      const cached = readCache(key);
      if (cached && Date.now() - cached.at < REFRESH_MS - 30_000) {
        setWeather(cached.weather);
        return;
      }
      weatherProvider
        .fetch({ latitude, longitude, units })
        .then((next) => {
          if (cancelled) return;
          setWeather(next);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ key, at: Date.now(), weather: next } satisfies Cached));
        })
        .catch((error) => console.warn('טעינת מזג האוויר נכשלה', error));
    };

    load(true);
    const timer = window.setInterval(() => load(), REFRESH_MS);
    // כשחוזרים ללשונית: טוענים רק אם המטמון כבר ישן
    const onVisible = () => load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key, latitude, longitude, units]);

  return weather;
}
