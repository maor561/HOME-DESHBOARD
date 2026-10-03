import { useMemo, type CSSProperties } from 'react';
import type { Orb } from '../../lib/sky';
import type { WeatherKind } from '../../types';

interface Props {
  weather: WeatherKind;
  /** כשמועבר, מצוירים שמש או ירח במיקומם בשמיים */
  orb?: Orb;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

function useParticles(weather: WeatherKind): { className: string; style: CSSProperties }[] {
  return useMemo(() => {
    if (weather === 'rain') {
      return Array.from({ length: 70 }, () => ({
        className: 'drop',
        style: { right: `${random(-5, 110)}%`, animationDuration: `${random(0.55, 1.05).toFixed(2)}s`, animationDelay: `-${Math.random().toFixed(2)}s`, opacity: random(0.3, 0.9) },
      }));
    }
    if (weather === 'snow') {
      return Array.from({ length: 60 }, () => {
        const size = `calc(var(--u) * ${random(0.25, 0.75).toFixed(2)})`;
        return {
          className: 'flake',
          style: { right: `${random(0, 100)}%`, width: size, height: size, animationDuration: `${random(8, 17).toFixed(1)}s`, animationDelay: `-${random(0, 14).toFixed(1)}s`, opacity: random(0.5, 1) },
        };
      });
    }
    return [];
  }, [weather]);
}

/** שכבות השמיים: צבע, זוהר, כוכבים, עננים, ערפל, גשם ושלג. הצבעים מגיעים ממשתני ה-CSS של הבמה. */
export function SkyBackdrop({ weather, orb }: Props) {
  const particles = useParticles(weather);
  return (
    <div className="skybox" aria-hidden="true">
      <div className="layer sky" />
      <div className="layer glow" />
      <div className="layer stars" />
      {orb && <div className={`orb ${orb.isDay ? '' : 'moon'}`} style={{ left: `${orb.leftPct}%`, top: `${orb.topPct}%` }} />}
      <div className="layer clouds"><i /><i /><i /></div>
      <div className="layer veil" />
      <div className="layer fog"><i /><i /><i /></div>
      <div className="layer fx">
        {particles.map((p, i) => <i key={i} className={p.className} style={p.style} />)}
      </div>
    </div>
  );
}
