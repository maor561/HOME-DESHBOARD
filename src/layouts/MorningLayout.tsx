import type { CSSProperties } from 'react';
import { SkyBackdrop } from '../components/dashboard/SkyBackdrop';
import { Clock, WeatherNow } from '../components/dashboard/widgets';
import type { DashboardModel } from '../hooks/useDashboard';

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
 * לכל ילד הכריך של היום, מה להביא, החוג והמשימה. לובש את הסגנון שנבחר בהגדרות.
 */
export function MorningLayout({ model }: { model: DashboardModel }) {
  const { morning, meals } = model;
  return (
    <section className={`sty s-morning s-${model.settings.style} on`}>
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
          </div>
        </div>
        <div className="m-kids" style={{ gridTemplateColumns: `repeat(${Math.max(1, morning.kids.length)}, minmax(0, 1fr))` }}>
          {morning.kids.map((kid, i) => (
            <div className="card kid" key={kid.member.id} style={{ '--p': PAPERS[i % 4][0], '--r': PAPERS[i % 4][1] } as CSSProperties}>
              <div className="kid-h">
                <span className="badge" style={{ '--c': kid.member.color } as CSSProperties}>{kid.member.name[0]}</span>
                <b>{kid.member.name}</b>
              </div>
              <Line icon="🥪" label="כריך" value={kid.sandwich} empty="לא נקבע" />
              <Line icon="🎒" label="להביא היום" value={kid.bring} />
              <Line icon="🕓" label="חוג אחר הצהריים" value={kid.activity} empty="אין חוג היום" />
              <Line icon="✅" label="משימה" value={kid.task} />
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
