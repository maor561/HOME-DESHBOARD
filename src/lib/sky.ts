import type { WeatherKind } from '../types';

export type Phase = 'dawn' | 'day' | 'sunset' | 'night';

export interface Sky {
  colors: [string, string, string];
  scheme: 'light' | 'dark';
  glow: string;
  veil: string;
}

export function phaseOf(minutes: number, sunrise: number, sunset: number): Phase {
  if (minutes >= sunrise - 40 && minutes < sunrise + 55) return 'dawn';
  if (minutes >= sunset - 55 && minutes < sunset + 35) return 'sunset';
  return minutes > sunrise && minutes < sunset ? 'day' : 'night';
}

const BASE: Record<Phase, Sky> = {
  dawn: { colors: ['#1f2b55', '#8a5a83', '#f0a877'], scheme: 'dark', glow: 'radial-gradient(60% 55% at 85% 100%, rgba(255,196,128,.75), transparent 70%)', veil: 'transparent' },
  day: { colors: ['#4f9fe6', '#9bcdf4', '#e9f6fd'], scheme: 'light', glow: 'radial-gradient(45% 50% at 50% -5%, rgba(255,250,220,.9), transparent 70%)', veil: 'transparent' },
  sunset: { colors: ['#2a2552', '#b54a72', '#f59e56'], scheme: 'dark', glow: 'radial-gradient(60% 55% at 12% 100%, rgba(255,170,90,.8), transparent 70%)', veil: 'transparent' },
  night: { colors: ['#050818', '#0f1736', '#1b2650'], scheme: 'dark', glow: 'radial-gradient(40% 45% at 20% 0%, rgba(150,170,255,.22), transparent 70%)', veil: 'transparent' },
};

const DAY_WEATHER: Partial<Record<WeatherKind, Partial<Sky>>> = {
  clouds: { colors: ['#7fa9cf', '#b6d0e5', '#e8eff5'] },
  rain: { colors: ['#35435a', '#56687f', '#8494a5'], scheme: 'dark', glow: 'none' },
  fog: { colors: ['#a9b3bc', '#c9d0d6', '#e8ebee'], glow: 'none' },
  snow: { colors: ['#9db3c9', '#cfdbe6', '#f5f8fb'], glow: 'none' },
};

const NIGHT_VEIL: Partial<Record<WeatherKind, string>> = {
  rain: 'rgba(14,20,34,.5)',
  fog: 'rgba(190,196,208,.2)',
  snow: 'rgba(210,222,240,.14)',
  clouds: 'rgba(40,46,66,.22)',
};

/** צבעי השמיים לפי שלב היום ומזג האוויר. */
export function skyOf(phase: Phase, weather: WeatherKind): Sky {
  if (phase === 'day') return { ...BASE.day, ...DAY_WEATHER[weather] };
  return { ...BASE[phase], veil: NIGHT_VEIL[weather] ?? 'transparent' };
}

export interface Orb {
  isDay: boolean;
  /** 0 = זריחה (ימין), 1 = שקיעה (שמאל) */
  t: number;
  leftPct: number;
  topPct: number;
}

/** מיקום השמש ביום או הירח בלילה לאורך הקשת. */
export function orbPosition(minutes: number, sunrise: number, sunset: number): Orb {
  const isDay = minutes > sunrise && minutes < sunset;
  const span = isDay ? sunset - sunrise : 1440 - (sunset - sunrise);
  const t = isDay ? (minutes - sunrise) / span : ((minutes - sunset + 1440) % 1440) / span;
  return { isDay, t, leftPct: (1 - t) * 100, topPct: 78 - Math.sin(Math.PI * t) * 62 };
}
