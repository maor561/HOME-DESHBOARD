import { Check, Cloud, CloudFog, CloudRain, Droplet, Moon, Snowflake, Sun, Wind, type LucideIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ActivityRow, DashboardModel, TaskRow } from '../../hooks/useDashboard';
import { EVENT_COLOR } from '../../lib/calendar';
import { formatMinutes, type UpcomingBirthday } from '../../lib/dates';
import type { WeatherKind } from '../../types';

const WEATHER_ICON: Record<WeatherKind, LucideIcon> = { clear: Sun, clouds: Cloud, rain: CloudRain, fog: CloudFog, snow: Snowflake };

interface CardProps {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({ title, children, className = '', style }: CardProps) {
  return (
    <div className={`card ${className}`} style={style}>
      <div className="label">{title}</div>
      {children}
    </div>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <div className="li"><small style={{ color: 'var(--soft)' }}>{children}</small></div>;

export function Clock({ value }: { value: string }) {
  const [hours, minutes] = value.split(':');
  return (
    <div className="clock" role="timer" aria-label={value}>
      {hours}<span className="colon">:</span>{minutes}
    </div>
  );
}

export function Heading({ model }: { model: DashboardModel }) {
  return (
    <>
      <div className="fam">{model.familyName}</div>
      <Clock value={model.clock} />
      <div className="date">{model.dateText}</div>
    </>
  );
}

export function WeatherNow({ model }: { model: DashboardModel }) {
  const { weather, phase, settings } = model;
  const Icon = weather.kind === 'clear' && phase === 'night' ? Moon : WEATHER_ICON[weather.kind];
  return (
    <div className="wx-now">
      <Icon className="ic" aria-hidden="true" />
      <div className="wx-temp">{weather.temp}°</div>
      <div className="wx-meta">
        <b>{weather.text} · {settings.city}</b>
        מרגיש כמו {weather.feels}°<br />
        <span><Droplet className="ic" aria-hidden="true" />{weather.humidity}%</span>
        <span><Wind className="ic" aria-hidden="true" />{weather.windKmh} קמ״ש</span>
      </div>
    </div>
  );
}

/**
 * לוח השנה השבועי, מראשון עד שבת: תאריך, תחזית ואירועים לכל יום.
 * בכל תא יש מקום לשני אירועים; כשיש יותר, הרשימה גוללת לאט למעלה ולמטה.
 */
export function WeekStrip({ model, style }: { model: DashboardModel; style?: CSSProperties }) {
  const { week, birthdays, show } = model;
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    root.current?.querySelectorAll<HTMLElement>('.evs').forEach((box) => {
      const shift = (box.firstElementChild?.scrollHeight ?? 0) - box.clientHeight;
      box.classList.toggle('scroll', shift > 4);
      box.style.setProperty('--shift', `-${shift}px`);
      box.style.setProperty('--dur', `${10 + shift / 6}s`);
    });
  });

  return (
    <div className="card week" style={style} ref={root}>
      <div className="week-top">
        <div className="label">{week.label} <em dir="ltr">{week.range}</em></div>
        {show('birthdays') && (
          <div className="bdl">
            🎂{' '}
            {birthdays.map((b, i) => (
              <span key={b.id}>
                {i > 0 && ' · '}
                <b>{b.name}</b>{b.age === null ? '' : ` (גיל ${b.age})`} <i>{b.days === 0 ? 'היום!' : `בעוד ${b.days} ימים`}</i>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="week-days">
        {week.days.map((day) => {
          const Icon = day.weather ? WEATHER_ICON[day.weather.kind] : null;
          return (
            <div key={day.date} className={`wd ${day.offset === 0 ? 'today' : day.offset < 0 ? 'past' : ''}`}>
              <div className="hd">
                <div className="dn">
                  <b>{day.name}</b>
                  <span className="n">{day.shortDate}{day.offset === 0 && <> · <span className="now">היום</span></>}</span>
                </div>
                {day.weather && Icon && <span className="w"><Icon className="ic" aria-hidden="true" /><span>{day.weather.max}°</span></span>}
              </div>
              <div className="evs">
                <div className="evs-in">
                  {day.events.length ? day.events.map((event) => (
                    <span key={event.key} className="ev" style={{ '--c': EVENT_COLOR[event.kind] } as CSSProperties}>{event.title}</span>
                  )) : <span className="none">—</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SunTimes({ model }: { model: DashboardModel }) {
  return (
    <>
      <span>זריחה<b className="num">{formatMinutes(model.weather.sunrise)}</b></span>
      <span>שקיעה<b className="num">{formatMinutes(model.weather.sunset)}</b></span>
    </>
  );
}

/** קשת היום: השמש נעה מזריחה (ימין) לשקיעה (שמאל); בלילה מוצג ירח. */
export function SunArc({ model }: { model: DashboardModel }) {
  const { isDay, t } = model.orb;
  const x = (1 - t) ** 2 * 290 + 2 * (1 - t) * t * 150 + t ** 2 * 10;
  const y = (1 - t) ** 2 * 46 + 2 * (1 - t) * t * -38 + t ** 2 * 46;
  return (
    <div className="arc">
      <svg viewBox="0 -4 300 56" aria-hidden="true">
        <path d="M290 46 Q150 -38 10 46" fill="none" stroke="var(--faint)" strokeWidth="1.2" strokeDasharray="2 5" strokeLinecap="round" />
        <line x1="0" y1="46" x2="300" y2="46" stroke="var(--line)" strokeWidth="1" />
        {isDay ? (
          <>
            <circle cx={x} cy={y} r="15" fill="var(--accent)" opacity=".22" />
            <circle cx={x} cy={y} r="7.5" fill="var(--accent)" />
          </>
        ) : (
          <g transform={`translate(${x - 9} ${y - 9}) scale(.75)`} fill="var(--ink)" opacity=".85">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </g>
        )}
      </svg>
      <div className="ends"><SunTimes model={model} /></div>
    </div>
  );
}

export function SandwichList({ model }: { model: DashboardModel }) {
  const { rows } = model.sandwiches;
  if (!rows.length) return <Empty>עוד לא תכננו כריכים למחר</Empty>;
  return (
    <div>
      {rows.map(({ member, text }) => (
        <div className="li" key={member.id}>
          <span className="who" style={{ '--c': member.color } as React.CSSProperties}>{member.name}</span>
          <b>{text}</b>
        </div>
      ))}
    </div>
  );
}

export const sandwichTitle = (model: DashboardModel) => <>כריכים למחר <em>· {model.sandwiches.dayLabel}</em></>;

export function MealsToday({ model, className = '' }: { model: DashboardModel; className?: string }) {
  const meals: [string, string][] = [['צהריים', model.meals.lunch], ['ערב', model.meals.dinner]];
  return (
    <div className={`meals ${className}`}>
      {meals.map(([label, text]) => (
        <div className="meal" key={label}>
          <small>{label}</small>
          <b>{text || '—'}</b>
        </div>
      ))}
    </div>
  );
}

export function ActivityList({ rows }: { rows: ActivityRow[] }) {
  if (!rows.length) return <Empty>אין חוגים היום ומחר</Empty>;
  return (
    <div>
      {rows.map((row) => (
        <div className={`row ${row.state === 'later' ? '' : row.state}`} key={row.id}>
          <span className="t">{row.time}</span>
          <span className="badge" style={{ '--c': row.color } as React.CSSProperties}>{row.icon}</span>
          <span className="main"><b>{row.title}</b><small>{row.sub}</small></span>
        </div>
      ))}
    </div>
  );
}

export function TaskList({ rows }: { rows: TaskRow[] }) {
  if (!rows.length) return <Empty>אין משימות פתוחות</Empty>;
  return (
    <div>
      {rows.map((task) => (
        <div className={`task ${task.done ? 'done' : ''}`} key={task.id}>
          <span className="box"><Check className="ic" aria-hidden="true" /></span>
          <b>{task.title}</b>
          {task.high && !task.done && <i className="hi" />}
          {task.member && <span className="who" style={{ '--c': task.member.color } as React.CSSProperties}>{task.member.name}</span>}
          <small>{task.due}</small>
        </div>
      ))}
    </div>
  );
}

export function BirthdayList({ rows, className = '' }: { rows: UpcomingBirthday[]; className?: string }) {
  return (
    <div className={className}>
      {rows.map((b) => {
        const age = b.age === null ? '' : ` · גיל ${b.age}`;
        return (
          <div className="bd" key={b.id}>
            <span className="badge" style={{ '--c': b.color } as React.CSSProperties}>{b.name[0]}</span>
            <span className="main">
              <b>{b.name}</b>
              <small>
                <span className="long">{b.longDate}{age}</span>
                <span className="short">{b.shortDate}<span className="age">{age}</span></span>
              </small>
            </span>
            <span className="in"><b>{b.days === 0 ? '🎉' : b.days}</b><small>{b.days === 0 ? 'היום!' : 'ימים'}</small></span>
          </div>
        );
      })}
    </div>
  );
}

export function Quote({ text }: { text: string | null }) {
  if (!text) return null;
  return <div className="quote"><small>משפט היום</small>״{text}״</div>;
}

/** תמונות משפחתיות מתחלפות בהצלבה איטית. */
export function PhotoFrame({ model }: { model: DashboardModel }) {
  const { photos, settings } = model;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((i) => (settings.photoShuffle ? (i + 1 + Math.floor(Math.random() * (photos.length - 1))) % photos.length : (i + 1) % photos.length)),
      settings.photoIntervalSec * 1000,
    );
    return () => window.clearInterval(timer);
  }, [photos.length, settings.photoIntervalSec, settings.photoShuffle]);

  return (
    <div className="photo">
      {photos.map((src, i) => <img key={src} src={src} alt="" className={i === index % photos.length ? 'on' : ''} />)}
    </div>
  );
}
