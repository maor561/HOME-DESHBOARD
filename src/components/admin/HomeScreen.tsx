import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { navigate } from '../../hooks/useRoute';
import { useNow } from '../../hooks/useNow';
import { WEEKDAYS, addDays, formatMinutes, minutesOf, toISODate, upcomingBirthdays } from '../../lib/dates';
import { store } from '../../services/store';
import { Avatar, IconButton, ListRow, Panel, ScreenHeader } from '../ui';
import { TaskSheet, newTask } from './TasksScreen';
import { useFamily, type ScreenProps } from './shared';

const STYLE_NAME = { glass: 'זכוכית ושמיים', board: 'לוח המקרר' };

const greeting = (hour: number) => (hour < 5 ? 'לילה טוב' : hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : hour < 21 ? 'ערב טוב' : 'לילה טוב');

/** מסך הבית: מה מוצג עכשיו, מה חסר, וקיצורים לפעולות הנפוצות. */
export function HomeScreen({ go }: ScreenProps) {
  const { db, settings, kids, members, memberById } = useFamily();
  const now = useNow();
  const [addingTask, setAddingTask] = useState(false);

  const today = toISODate(now);
  const tomorrowDate = addDays(now, 1);
  const tomorrow = toISODate(tomorrowDate);
  const sandwichesTomorrow = db.meals.filter((m) => m.date === tomorrow && m.kind === 'sandwich' && m.text).length;
  const meal = (kind: 'lunch' | 'dinner') => db.meals.find((m) => m.date === today && m.kind === kind)?.text;
  const activities = db.activities.filter((a) => a.weekday === now.getDay()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const openTasks = db.tasks.filter((t) => !t.done).length;
  const birthday = upcomingBirthdays(members, db.birthdays, now, 1)[0];

  const quick: [string, string, string, () => void][] = [
    ['🥪', 'כריכים למחר', `יום ${WEEKDAYS[tomorrowDate.getDay()]} · ${sandwichesTomorrow} מתוך ${kids.length}`, () => go('menu')],
    ['🍝', 'מה אוכלים', 'התפריט השבועי', () => go('menu')],
    ['✅', 'משימה חדשה', `${openTasks} פתוחות`, () => setAddingTask(true)],
    ['🛒', 'רשימת קניות', `${db.shopping_items.filter((i) => !i.done).length} פריטים`, () => go('shop')],
  ];

  return (
    <>
      <ScreenHeader title={`${greeting(now.getHours())}, ${db.families[0]?.name ?? ''}`} />
      <section className="admin-sky relative mb-3.5 overflow-hidden rounded-[26px] p-5 text-white">
        <small className="font-semibold opacity-85">המסך בבית</small>
        <div className="my-1 text-right font-serif text-[64px] font-medium leading-none" dir="ltr">{formatMinutes(minutesOf(now))}</div>
        <small className="font-semibold opacity-85">סגנון: {STYLE_NAME[settings.style]} · {settings.city}</small>
        <div className="mt-3 flex items-center justify-between">
          <span className="rounded-full bg-black/25 px-3 py-1 text-[13px] font-bold">{store.mode === 'cloud' ? 'מסונכרן בענן' : 'נתונים מקומיים במכשיר הזה'}</span>
          <button className="text-sm font-bold underline underline-offset-4" onClick={() => navigate('/dashboard')}>פתיחת המסך</button>
        </div>
      </section>

      {sandwichesTomorrow < kids.length && (
        <div className="mb-3.5 flex items-center gap-2.5 rounded-2xl bg-[#fff4d6] px-3.5 py-3 text-[15px] font-semibold">
          🥪 חסרים {kids.length - sandwichesTomorrow} כריכים למחר
          <button className="ms-auto whitespace-nowrap font-bold text-accent" onClick={() => go('menu')}>להשלים</button>
        </div>
      )}

      <div className="mb-3.5 grid grid-cols-2 gap-2.5">
        {quick.map(([emoji, title, sub, onClick]) => (
          <button key={title} onClick={onClick} className="flex min-h-[92px] flex-col justify-between rounded-[20px] bg-card p-3.5 text-start shadow-[0_1px_0_var(--color-line)]">
            <span className="text-2xl">{emoji}</span>
            <span><b className="block">{title}</b><small className="text-[13px] text-soft">{sub}</small></span>
          </button>
        ))}
      </div>

      <Panel title="היום בבית">
        <ListRow lead={<Avatar color="#e08a1a">🍽</Avatar>} title={meal('lunch') || 'צהריים: לא נקבע'} subtitle={`ערב: ${meal('dinner') || 'לא נקבע'}`}>
          <IconButton label="עריכת התפריט" onClick={() => go('menu')}><Pencil className="size-5" /></IconButton>
        </ListRow>
        <ListRow
          lead={<Avatar color="#3f8fdc">{activities[0]?.icon ?? '🗓'}</Avatar>}
          title={activities.length ? `${activities.length} חוגים היום` : 'אין חוגים היום'}
          subtitle={activities.map((a) => `${memberById.get(a.memberId)?.name ?? ''} ${a.startTime}`).join(' · ')}
        >
          <IconButton label="עריכת חוגים" onClick={() => go('acts')}><Pencil className="size-5" /></IconButton>
        </ListRow>
        {birthday && (
          <ListRow
            lead={<Avatar color={birthday.color}>🎂</Avatar>}
            title={birthday.days === 0 ? `היום יום ההולדת של ${birthday.name}!` : `יום ההולדת של ${birthday.name} בעוד ${birthday.days} ימים`}
            subtitle={`${birthday.longDate}${birthday.age === null ? '' : ` · גיל ${birthday.age}`}`}
          />
        )}
      </Panel>
      {addingTask && <TaskSheet task={newTask()} isNew onClose={() => setAddingTask(false)} />}
    </>
  );
}
