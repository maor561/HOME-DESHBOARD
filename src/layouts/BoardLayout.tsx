import type { CSSProperties } from 'react';
import { SkyBackdrop } from '../components/dashboard/SkyBackdrop';
import {
  ActivityList, Card, Heading, MealsToday, PhotoFrame, Quote, SandwichList, TasksCard, WeatherNow, WeekStrip, sandwichTitle,
} from '../components/dashboard/widgets';
import type { DashboardModel } from '../hooks/useDashboard';

/** פתק על הלוח: זווית הטיה וצבע נייר */
const note = (rotate: string, paper: string) => ({ '--r': rotate, '--p': paper }) as CSSProperties;

/**
 * סגנון "לוח המקרר": פתקים ופולארויד על רקע שמיים שמשתנים לפי השעה ומזג האוויר.
 * למעלה מזג האוויר, שעון ותמונה; באמצע שלושה פתקים; למטה לוח השנה השבועי.
 */
export function BoardLayout({ model }: { model: DashboardModel }) {
  const { show } = model;
  return (
    <section className="sty s-board on">
      <SkyBackdrop weather={model.weather.kind} orb={model.orb} />
      <div className="ui">
        <div className="top">
          <div className="wall wallwx">{show('weather') && <WeatherNow model={model} />}</div>
          <div className="head wall"><Heading model={model} /></div>
          {show('photos') ? (
            <div className="polaroid">
              <div className="pic"><PhotoFrame model={model} /></div>
              {show('quote') && <Quote text={model.quote} />}
            </div>
          ) : <div />}
        </div>
        <div className="notes">
          {(show('sandwiches') || show('meals')) && (
            <Card title={show('sandwiches') ? sandwichTitle(model) : 'מה אוכלים היום'} style={note('-.7deg', '#fff3a8')}>
              {show('sandwiches') && <SandwichList model={model} />}
              {show('meals') && <MealsToday model={model} className={show('sandwiches') ? 'sub' : ''} />}
            </Card>
          )}
          {show('activities') && <Card title={model.activities.title} style={note('.5deg', '#dcebf7')}><ActivityList rows={model.activities.rows} /></Card>}
          {show('tasks') && <TasksCard model={model} style={note('-.4deg', '#fde3e0')} />}
        </div>
        {show('calendar') && <WeekStrip model={model} style={note('0deg', '#fffdf7')} />}
      </div>
    </section>
  );
}
