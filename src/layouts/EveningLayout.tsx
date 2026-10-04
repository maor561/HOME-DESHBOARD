import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import { SkyBackdrop } from '../components/dashboard/SkyBackdrop';
import { Clock, WEATHER_ICON } from '../components/dashboard/widgets';
import type { DashboardModel } from '../hooks/useDashboard';
import { weatherText } from '../services/weather';

/** צבע הנייר וההטיה של הכרטיסים בסגנון "לוח המקרר" */
const PAPERS: [string, string][] = [['#fde3e0', '-.6deg'], ['#ece2f8', '.5deg'], ['#dcebf7', '-.4deg'], ['#fff3a8', '.6deg']];

/**
 * "מתכוננים למחר": רשימת הכנות לכל ילד, ומה מחכה לו מחר. מחליף את המסך הרגיל בערבים
 * ובשעות שבהגדרות, וחוזר למסך הרגיל כשכל הילדים מוכנים. לובש את הסגנון שנבחר בהגדרות.
 */
export function EveningLayout({ model }: { model: DashboardModel }) {
  const { evening } = model;
  const Icon = evening.tomorrowWeather ? WEATHER_ICON[evening.tomorrowWeather.kind] : null;
  const readyKids = evening.kids.filter((kid) => kid.ready).length;
  return (
    <section className={`sty s-morning s-evening s-${model.settings.style} on`}>
      <SkyBackdrop weather={model.weather.kind} orb={model.orb} />
      <div className="mg">
        <div className="m-top">
          <div className="wall">
            <div className="fam">מתכוננים למחר</div>
            <Clock value={model.clock} />
            <div className="date">{model.dateText}</div>
          </div>
          <div className="wall m-wx">
            <small className="m-cap">מחר · {evening.tomorrowLabel}</small>
            {evening.tomorrowWeather && Icon && (
              <div className="wx-now">
                <Icon className="ic" aria-hidden="true" />
                <div className="wx-temp">{evening.tomorrowWeather.max}°</div>
                <div className="wx-meta"><b>{weatherText(evening.tomorrowWeather.kind)}</b>בשיא היום</div>
              </div>
            )}
            {evening.tip && <div className="m-tip">{evening.tip}</div>}
          </div>
          <div className="wall m-go">
            <small>מוכנים</small>
            <b>{readyKids}/{evening.kids.length}</b>
            <small>{evening.doneCount} מתוך {evening.totalCount} הכנות</small>
          </div>
        </div>
        <div className="m-kids" style={{ gridTemplateColumns: `repeat(${Math.max(1, evening.kids.length)}, minmax(0, 1fr))` }}>
          {evening.kids.map((kid, i) => {
            const done = kid.items.filter((item) => item.done).length;
            return (
              <div className={`card kid ${kid.ready ? 'ready' : ''}`} key={kid.member.id} style={{ '--p': PAPERS[i % 4][0], '--r': PAPERS[i % 4][1] } as CSSProperties}>
                <div className="kid-h">
                  <span className="badge" style={{ '--c': kid.member.color } as CSSProperties}>{kid.member.name[0]}</span>
                  <b>{kid.member.name}</b>
                  <span className="prog">{kid.ready ? '🌙 מוכן' : `${done}/${kid.items.length}`}</span>
                </div>
                {kid.items.map((item) => (
                  <div className={`ck ${item.done ? 'done' : ''}`} key={item.id}>
                    <span className="box"><Check className="ic" aria-hidden="true" /></span>
                    {item.text}
                  </div>
                ))}
                {(kid.sandwich || kid.bring) && (
                  <div className="tom">
                    <b>מחר:</b>
                    {kid.sandwich && <><br />🥪 {kid.sandwich}</>}
                    {kid.bring && <><br />🎒 {kid.bring}</>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {(evening.highlight || evening.activities) && (
          <div className="card m-foot" style={{ '--p': '#fffdf7', '--r': '0deg' } as CSSProperties}>
            {evening.highlight && <span><small>מחר בלוח</small><b>{evening.highlight}</b></span>}
            {evening.activities && <span><small>חוגים מחר</small><b>{evening.activities}</b></span>}
          </div>
        )}
      </div>
    </section>
  );
}
