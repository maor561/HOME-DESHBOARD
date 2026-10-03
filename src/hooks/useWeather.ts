import { useEffect, useState } from 'react';
import { fallbackWeather, weatherProvider } from '../services/weather';
import type { Settings, Weather } from '../types';

const REFRESH_MS = 15 * 60_000;

/** מזג אוויר חי למיקום שבהגדרות, מתרענן כל רבע שעה. בכשל נשארים עם הנתונים האחרונים. */
export function useWeather(settings: Settings): Weather {
  const [weather, setWeather] = useState<Weather>(() => fallbackWeather());
  const { latitude, longitude, units } = settings;

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      weatherProvider
        .fetch({ latitude, longitude, units })
        .then((next) => !cancelled && setWeather(next))
        .catch((error) => console.warn('טעינת מזג האוויר נכשלה', error));
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [latitude, longitude, units]);

  return weather;
}
