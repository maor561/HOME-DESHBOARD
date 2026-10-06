import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import { SkyBackdrop } from '../components/dashboard/SkyBackdrop';
import { Clock, WeatherNow } from '../components/dashboard/widgets';
import type { DashboardModel } from '../hooks/useDashboard';
import { useFitCards } from '../hooks/useFitCards';

/** צבע הנייר וההטיה של הכרטיסים בסגנון "לוח המקרר" */
const PAPERS: [string, string][] = [['#fde3e0', '-.6deg'], ['#ece2f8', '.5deg'], ['#dcebf7', '-.4deg'], ['#fff3a8', '.6deg']];

function Line({ icon, label, value, empty }: { icon: string; label: string; value: string; empty?: string }) {
  if (!value && !empty) return null;
  return (
    <div className={`kr ${value ? '' : 'none'}`}>
      <span className="e">{icon}</span>
      <span><small>{label}</small><b>{value || empty}</b></span>
    </div>
  );
}

/**
 * מסך היציאה מהבית. מחליף את המסך הרגיל בבקרי ימי הלימודים, עד קצת אחרי שעת היציאה:
 * לכל ילד הכנות הבוקר שלו (מסתמנות כשהוא מדווח), הכריך של היום, מה להביא והחוג.
 * ילד בלי הכנות בוקר מקבל כרטיס מידע בלבד. לובש את הסגנון שנבחר בהגדרות.
 */
export function MorningLayout({ model }: { model: DashboardModel }) {
  const { morning, meals } = model;
  const kidsRef = useFitCards();
  const withList = morning.kids.filter((kid) => kid.items.length > 0);
  const readyKids = withList.filter((kid) => kid.ready).length;
  return (
    <section className={`sty s-morning s-compact s-${model.settings.style} on`}>
      <SkyBackdrop weather={model.weather.kind} orb={model.orb} />
      <div className="mg">
        <div className="m-top">
          <div className="wall">
            <div className="fam">בוקר טוב, {model.familyName}</div>
            <Clock value={model.clock} />
            <div className="date">{model.dateText}</div>
          </div>
          <div className="wall m-wx">
            <WeatherNow model={model} />
            <div className="m-tip">{morning.tip}</div>
          </div>
          <div className="wall m-go">
            <small>{morning.leaveIn > 0 ? 'יוצאים בעוד' : 'שעת היציאה עברה'}</small>
            <b>{morning.leaveIn > 0 ? `${morning.leaveIn} דק׳` : 'יצאנו! 👋'}</b>
            <small>שעת יציאה {morning.leaveAt}</small>
            {withList.length > 0 && <span className="m-ready">☀️ מוכנים {readyKids}/{withList.length}</span>}
          </div>
        </div>
        <div className="m-kids" ref={kidsRef} style={{ gridTemplateColumns: `repeat(${Math.max(1, morning.kids.length)}, minmax(0, 1fr))` }}>
          {morning.kids.map((kid, i) => (
            <div className={`card kid ${kid.ready ? 'ready' : ''}`} key={kid.member.id} style={{ '--p': PAPERS[i % 4][0], '--r': PAPERS[i % 4][1] } as CSSProperties}>
              <div className="kid-in">
              <div className="kid-h">
                <span className="badge" style={{ '--c': kid.member.color } as CSSProperties}>{kid.member.name[0]}</span>
                <b>{kid.member.name}</b>
                {kid.items.length > 0 && <span className="prog">{kid.ready ? '☀️ מוכן' : `${kid.items.filter((item) => item.done).length}/${kid.items.length}`}</span>}
              </div>
              {kid.items.length > 0 ? (
                <>
                  {kid.items.map((item) => (
                    <div className={`ck ${item.done ? 'done' : ''}`} key={item.id}>
                      <span className="box"><Check className="ic" aria-hidden="true" /></span>
                      <span className="ck-e">{item.icon}</span>
                      {item.text}
                    </div>
                  ))}
                  {(kid.sandwich || kid.bring || kid.activity) && (
                    <div className="tom today">
                      {kid.sandwich && <span>🥪 <b>{kid.sandwich}</b></span>}
                      {kid.bring && <span>🎒 <b>{kid.bring}</b></span>}
                      {kid.activity && <span>🕓 <b>{kid.activity}</b></span>}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Line icon="🥪" label="כריך" value={kid.sandwich} empty="לא נקבע" />
                  <Line icon="🎒" label="להביא היום" value={kid.bring} />
                  <Line icon="🕓" label="חוג אחר הצהריים" value={kid.activity} empty="אין חוג היום" />
                  <Line icon="✅" label="משימה" value={kid.task} />
                </>
              )}
              </div>
            </div>
          ))}
        </div>
        <div className="card m-foot" style={{ '--p': '#fffdf7', '--r': '0deg' } as CSSProperties}>
          <span><small>צהריים</small><b>{meals.lunch || '—'}</b></span>
          <span><small>ערב</small><b>{meals.dinner || '—'}</b></span>
          {morning.highlight && <span><small>היום בלוח</small><b>{morning.highlight}</b></span>}
        </div>
      </div>
    </section>
  );
}
