import { SkyBackdrop } from '../components/dashboard/SkyBackdrop';
import {
  ActivityList, BirthdayList, Card, Heading, MealsToday, PhotoFrame, Quote, SandwichList, SunArc, TasksCard, WeatherNow, WeekStrip, sandwichTitle,
} from '../components/dashboard/widgets';
import type { DashboardModel } from '../hooks/useDashboard';

/** סגנון "זכוכית ושמיים": כרטיסי זכוכית על שמיים שמשתנים לפי השעה ומזג האוויר, ולוח שנה שבועי בתחתית. */
export function GlassLayout({ model }: { model: DashboardModel }) {
  const { show } = model;
  const food = show('sandwiches') || show('meals');
  return (
    <section className="sty s-glass on">
      <SkyBackdrop weather={model.weather.kind} />
      <div className="ui">
        <div className="col">
          <div><Heading model={model} /></div>
          {show('sun') && <SunArc model={model} />}
          {show('weather') && <div className="card wxcard"><WeatherNow model={model} /></div>}
        </div>
        <div className="col">
          {food && (
            <Card title={show('sandwiches') ? sandwichTitle(model) : 'מה אוכלים היום'}>
              {show('sandwiches') && <SandwichList model={model} />}
              {show('sandwiches') && show('meals') && <div className="label sublabel">מה אוכלים היום</div>}
              {show('meals') && <MealsToday model={model} />}
            </Card>
          )}
          {show('activities') && <Card title={model.activities.title} className="grow"><ActivityList rows={model.activities.rows} /></Card>}
        </div>
        <div className="col">
          {show('photos') ? (
            <div className="frame">
              <PhotoFrame model={model} />
              {show('quote') && <div className="cap"><Quote text={model.quote} /></div>}
            </div>
          ) : (
            show('quote') && <div className="card grow" style={{ justifyContent: 'center' }}><Quote text={model.quote} /></div>
          )}
          {show('tasks') && <TasksCard model={model} />}
          {/* בלי לוח השנה, ימי ההולדת חוזרים לכרטיס משלהם */}
          {!show('calendar') && show('birthdays') && <Card title="ימי הולדת קרובים"><BirthdayList rows={model.birthdays} /></Card>}
        </div>
        {show('calendar') && <WeekStrip model={model} />}
      </div>
    </section>
  );
}
