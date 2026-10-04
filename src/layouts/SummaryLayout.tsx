import type { CSSProperties } from 'react';
import { SkyBackdrop } from '../components/dashboard/SkyBackdrop';
import { PhotoFrame } from '../components/dashboard/widgets';
import type { DashboardModel } from '../hooks/useDashboard';

const PAPERS: [string, string][] = [['#fde3e0', '-.5deg'], ['#ece2f8', '.4deg'], ['#dcebf7', '-.3deg'], ['#fff3a8', '.5deg']];
const note = (rotate: string, paper: string) => ({ '--r': rotate, '--p': paper }) as CSSProperties;

function Lines({ rows, empty }: { rows: { label: string; title: string }[]; empty: string }) {
  if (!rows.length) return <div className="li"><small>{empty}</small></div>;
  return <div>{rows.map((row, i) => <div className="li" key={i}><small>{row.label}</small><b>{row.title}</b></div>)}</div>;
}

/**
 * "השבוע שלנו": סיכום שבועי. לכל ילד כמה כוכבים אסף וכמה משימות השלים השבוע,
 * מה היה השבוע ומה מחכה בשבוע הבא. מוצג ביום ובשעות שבהגדרות.
 */
export function SummaryLayout({ model }: { model: DashboardModel }) {
  const { summary, week, show } = model;
  return (
    <section className={`sty s-morning s-summary s-${model.settings.style} on`}>
      <SkyBackdrop weather={model.weather.kind} orb={model.orb} />
      <div className="mg">
        <div className="sum-head wall">
          <div><div className="fam">{model.familyName}</div><h1>השבוע שלנו</h1></div>
          <div className="sum-range">{week.range}<small>סיכום שבועי</small></div>
        </div>
        <div className="m-kids sum-kids" style={{ gridTemplateColumns: `repeat(${Math.max(1, summary.kids.length)}, minmax(0, 1fr))` }}>
          {summary.kids.map((kid, i) => (
            <div className="card" key={kid.member.id} style={note(PAPERS[i % 4][1], PAPERS[i % 4][0])}>
              <span className="badge" style={{ '--c': kid.member.color } as CSSProperties}>
                {kid.top && <span className="crown">👑</span>}
                {kid.member.name[0]}
              </span>
              <div className="nm">{kid.member.name}</div>
              <div className="st">⭐ {kid.stars}<small>כוכבים השבוע</small></div>
              <div className="tk">{kid.total ? <><b>{kid.done}</b> מתוך {kid.total} משימות</> : 'בלי משימות השבוע'}</div>
              <div className="pb" style={{ '--c': kid.member.color } as CSSProperties}><i style={{ width: `${kid.total ? Math.round((kid.done / kid.total) * 100) : 0}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="sum-bottom">
          <div className="card" style={note('-.4deg', '#dcebf7')}><div className="label">מה היה לנו השבוע</div><Lines rows={summary.was} empty="שבוע רגיל ושקט" /></div>
          <div className="card" style={note('.4deg', '#fff3a8')}><div className="label">מה מחכה בשבוע הבא</div><Lines rows={summary.next} empty="עוד אין אירועים" /></div>
          {show('photos') ? <div className="frame sum-photo"><PhotoFrame model={model} /></div> : <div />}
        </div>
      </div>
    </section>
  );
}
