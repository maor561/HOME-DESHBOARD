import type { Settings, Weather, WeatherKind } from '../types';

/** ספק מזג אוויר. כדי לעבור לשירות אחר מממשים את הממשק הזה ומחליפים את weatherProvider. */
export interface WeatherProvider {
  fetch(settings: Pick<Settings, 'latitude' | 'longitude' | 'units'>): Promise<Weather>;
}

const TEXT: Record<WeatherKind, string> = { clear: 'בהיר', clouds: 'מעונן', rain: 'גשם', fog: 'ערפל', snow: 'שלג' };

/** קודי WMO של Open-Meteo */
function kindOf(code: number): WeatherKind {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'clouds';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'rain';
}

const isoToMinutes = (iso: string): number => {
  const [h, m] = iso.slice(11, 16).split(':').map(Number);
  return h * 60 + m;
};

interface OpenMeteoResponse {
  current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number };
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; sunrise: string[]; sunset: string[] };
}

export const openMeteo: WeatherProvider = {
  async fetch({ latitude, longitude, units }) {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
      daily: 'weather_code,temperature_2m_max,sunrise,sunset',
      timezone: 'auto',
      forecast_days: '9',
      temperature_unit: units === 'f' ? 'fahrenheit' : 'celsius',
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const data = (await response.json()) as OpenMeteoResponse;
    const kind = kindOf(data.current.weather_code);
    return {
      kind,
      text: TEXT[kind],
      temp: Math.round(data.current.temperature_2m),
      feels: Math.round(data.current.apparent_temperature),
      humidity: Math.round(data.current.relative_humidity_2m),
      windKmh: Math.round(data.current.wind_speed_10m),
      sunrise: isoToMinutes(data.daily.sunrise[0]),
      sunset: isoToMinutes(data.daily.sunset[0]),
      forecast: data.daily.time.map((date, i) => ({
        date,
        kind: kindOf(data.daily.weather_code[i]),
        max: Math.round(data.daily.temperature_2m_max[i]),
      })),
      live: true,
    };
  },
};

/** נתוני ברירת מחדל שמוצגים עד שהתשובה הראשונה מגיעה, או כשאין רשת. */
export function fallbackWeather(): Weather {
  return {
    kind: 'clear', text: TEXT.clear, temp: 24, feels: 24, humidity: 50, windKmh: 10, sunrise: 6 * 60 + 30, sunset: 18 * 60 + 30,
    forecast: [],
    live: false,
  };
}

export const weatherText = (kind: WeatherKind): string => TEXT[kind];
export const weatherProvider: WeatherProvider = openMeteo;
