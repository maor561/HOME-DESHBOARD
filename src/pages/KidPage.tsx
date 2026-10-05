import { Check } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { ViewerGate } from '../components/dashboard/ViewerGate';
import { Toaster, toast } from '../components/ui';
import { useDatabase } from '../hooks/useDatabase';
import { useHolidays } from '../hooks/useHolidays';
import { useNow } from '../hooks/useNow';
import { buildWeek, displayedWeekStart } from '../lib/calendar';
import { WEEKDAYS, addDays, formatLongDate, minutesOf, timeToMinutes, toISODate, upcomingBirthdays } from '../lib/dates';
import { kidAddShopping, kidRequestReward, kidRequestSandwich, kidSendMessage, kidToggleRoutine, kidToggleTask, menuHistory } from '../services/mutations';
import { store } from '../services/store';
import type { SupabaseStore } from '../services/supabaseStore';
import type { Database, FamilyMember, Task } from '../types';

type Tab = 'today' | 'tasks' | 'week' | 'ask';
const TABS: [Tab, string, string][] = [['today', '☀️', 'היום'], ['tasks', '⭐', 'משימות'], ['week', '🗓', 'השבוע'], ['ask', '💬', 'בקשות']];
const SOFT = 'bg-[color-mix(in_srgb,var(--kc)_15%,white)]';
const KID_MESSAGES = ['אני בדרך הביתה', 'מי בא לשחק?', 'סיימתי שיעורים!'];

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh bg-[#1b1d27] text-ink">
      <div className="relative mx-auto flex h-full max-w-[430px] flex-col overflow-hidden bg-paper">{children}</div>
    </div>
  );
}

function Hero({ icon, title, subtitle, children, side }: { icon: ReactNode; title: string; subtitle: string; children?: ReactNode; side?: ReactNode }) {
  return (
    <header className="-mx-4 mb-3.5 rounded-b-[30px] bg-[linear-gradient(150deg,color-mix(in_srgb,var(--kc)_78%,#1a1040),var(--kc)_55%,color-mix(in_srgb,var(--kc)_60%,#ffcf8a))] px-5 pb-5 pt-[22px] text-white">
      <div className="flex items-center gap-3">
        <span className="grid size-14 flex-none place-items-center rounded-full border-2 border-white/60 bg-white/25 font-serif text-[26px] font-bold">{icon}</span>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[30px] font-bold leading-tight">{title}</h1>
          <p className="font-semibold opacity-90">{subtitle}</p>
        </div>
        {side}
      </div>
      {children}
    </header>
  );
}

function Section({ title, side, children }: { title: string; side?: ReactNode; children: ReactNode }) {
  return (
    <>
      <h2 className="mx-1 mb-2 mt-[18px] flex items-center gap-2 text-[13px] font-extrabold tracking-widest text-soft">
        <span className="size-[7px] rounded-full bg-[var(--kc)]" />
        {title}
        {side && <span className="ms-auto tracking-normal text-[var(--kc)]">{side}</span>}
      </h2>
      {children}
    </>
  );
}

const Box = ({ children }: { children: ReactNode }) => (
  <div className="divide-y divide-line rounded-[22px] bg-card px-4 py-1.5 shadow-[0_1px_0_var(--color-line),0_8px_22px_rgba(60,40,10,.05)]">{children}</div>
);

function Info({ icon, label, value, side }: { icon: string; label: string; value: string; side?: string }) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 py-3">
      <span className={`grid size-11 flex-none place-items-center rounded-[14px] text-[22px] ${SOFT}`}>{icon}</span>
      <span className="min-w-0 flex-1"><small className="block text-[13px] font-bold text-soft">{label}</small><b className="block text-[17px] leading-snug">{value}</b></span>
      {side && <span className="whitespace-nowrap text-sm font-bold text-[var(--kc)]">{side}</span>}
    </div>
  );
}

function TaskRow({ task, label }: { task: Task; label?: string }) {
  const toggle = () => kidToggleTask(task).catch((error: Error) => toast(`לא הצלחתי לשמור: ${error.message}`));
  return (
    <div className="flex min-h-[60px] items-center gap-3 py-3">
      <button role="checkbox" aria-checked={task.done} aria-label={`סימון: ${task.title}`} onClick={toggle}
        className={`grid size-[34px] flex-none place-items-center rounded-xl border-[2.5px] transition-colors ${task.done ? 'border-ok bg-ok text-white' : 'border-faint text-transparent'}`}>
        <Check className="size-5" strokeWidth={3} />
      </button>
      <span className="min-w-0 flex-1">
        {label && <small className="block text-[13px] font-bold text-soft">{label}</small>}
        <b className={`block text-[17px] leading-snug ${task.done ? 'font-medium text-faint line-through' : ''}`}>{task.title}</b>
      </span>
      <span className="whitespace-nowrap text-sm font-bold text-[var(--kc)]">⭐ {task.stars}</span>
    </div>
  );
}

/** המסך האישי של ילד: רואה רק את מה ששלו, מסמן משימות, ומבקש כריך או פריט לקניות. */
function KidApp({ member, db }: { member: FamilyMember; db: Database }) {
  const [tab, setTab] = useState<Tab>('today');
  const now = useNow();
  const settings = db.settings[0];
  const weekStart = displayedWeekStart(now);
  const holidays = useHolidays(toISODate(weekStart), toISODate(addDays(weekStart, 6)), settings);

  const today = toISODate(now);
  const tomorrow = toISODate(addDays(now, 1));
  const meal = (date: string, kind: 'sandwich' | 'lunch' | 'dinner') =>
    db.meals.find((m) => m.date === date && m.kind === kind && m.memberId === (kind === 'sandwich' ? member.id : null))?.text ?? '';
  const myActivities = db.activities.filter((a) => a.memberId === member.id).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const todayActivities = myActivities.filter((a) => a.weekday === now.getDay());
  const next = todayActivities.find((a) => timeToMinutes(a.endTime) > minutesOf(now));
  const bring = [...new Set(todayActivities.map((a) => a.bring).filter(Boolean))].join(', ');

  const mine = db.tasks.filter((t) => t.memberId === member.id);
  const doneToday = (t: Task) => t.done && t.completedAt !== null && toISODate(new Date(t.completedAt)) === today;
  const todayTasks = mine.filter((t) => (!t.done && (!t.dueDate || t.dueDate <= today)) || doneToday(t));
  const laterTasks = mine.filter((t) => !t.done && t.dueDate !== null && t.dueDate > today).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const doneCount = todayTasks.filter((t) => t.done).length;

  // שגרת הערב: מוצגת בשעות ובערבים שבהגדרות
  const routine = db.routine_items.filter((item) => item.memberId === member.id && item.period === 'evening').sort((a, b) => a.sortOrder - b.sortOrder);
  const checked = (itemId: string) => db.routine_checks.some((c) => c.itemId === itemId && c.date === today);
  const { evening } = settings;
  const inEvening =
    new URLSearchParams(window.location.search).get('mode') === 'evening' ||
    (evening.enabled && evening.days.includes(now.getDay()) && minutesOf(now) >= timeToMinutes(evening.from) && minutesOf(now) < timeToMinutes(evening.to));
  const routineDone = routine.filter((item) => checked(item.id)).length;

  // כוכבים ופרסים
  const weekFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const weekStars = db.star_log.filter((e) => e.memberId === member.id && e.kind === 'task' && new Date(e.createdAt) >= weekFrom).reduce((sum, e) => sum + e.amount, 0);
  const rewards = db.rewards.filter((r) => r.memberId === null || r.memberId === member.id).sort((a, b) => a.cost - b.cost);
  const nextReward = rewards.find((r) => r.cost > member.stars) ?? rewards[rewards.length - 1];
  const pendingReward = (rewardId: string) => db.reward_requests.some((r) => r.memberId === member.id && r.rewardId === rewardId && r.status === 'pending');

  let body: ReactNode;
  if (tab === 'today') {
    body = (
      <>
        <Hero icon={member.name[0]} title={`היי ${member.name}!`} subtitle={formatLongDate(now).replace(/ \d{4}$/, '')}
          side={<span className="whitespace-nowrap rounded-full bg-black/20 px-3.5 py-1.5 text-lg font-extrabold">⭐ {member.stars}</span>}>
          {next && (
            <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-white/20 px-3.5 py-3">
              <span className="text-[30px]">{next.icon}</span>
              <div><small className="block text-[13px] font-bold opacity-90">הדבר הבא שלך</small><b className="text-[19px]">{next.title} ב-{next.startTime}</b></div>
            </div>
          )}
        </Hero>
        {inEvening && routine.length > 0 && (
          <Section title="ערב · מתכוננים למחר">
            <div className="rounded-[22px] bg-[linear-gradient(150deg,#1b2650,#3a2f6b)] px-4 pb-2 pt-3.5 text-white">
              <h3 className="flex items-center gap-2 font-serif text-[21px] font-bold">
                🌙 {routineDone === routine.length ? 'הכול מוכן למחר!' : 'מה נשאר למחר?'}
                <span className="ms-auto rounded-full bg-white/20 px-3 py-0.5 font-sans text-[15px] font-extrabold">{routineDone}/{routine.length}</span>
              </h3>
              <div className="divide-y divide-white/20">
                {routine.map((item) => {
                  const done = checked(item.id);
                  return (
                    <div key={item.id} className="flex min-h-[54px] items-center gap-3 py-2">
                      <button role="checkbox" aria-checked={done} aria-label={`סימון: ${item.text}`}
                        onClick={() => kidToggleRoutine(item, today).catch((error: Error) => toast(`לא הצלחתי לשמור: ${error.message}`))}
                        className={`grid size-[34px] flex-none place-items-center rounded-xl border-[2.5px] ${done ? 'border-ok bg-ok text-white' : 'border-white/60 text-transparent'}`}>
                        <Check className="size-5" strokeWidth={3} />
                      </button>
                      <span className="text-2xl">{item.icon}</span>
                      <b className={`text-[17px] ${done ? 'font-medium text-white/50 line-through' : ''}`}>{item.text}</b>
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>
        )}
        <Section title="היום שלי">
          <Box>
            {member.getsSandwich && <Info icon="🥪" label="הכריך שלי" value={meal(today, 'sandwich') || 'עוד לא נקבע'} />}
            {bring && <Info icon="🎒" label="להביא היום" value={bring} />}
            {todayActivities.map((a) => <Info key={a.id} icon={a.icon} label={`חוג · ${a.startTime}–${a.endTime}`} value={a.title} side={a.place} />)}
            <Info icon="🍝" label="צהריים · ערב" value={`${meal(today, 'lunch') || '—'} · ${meal(today, 'dinner') || '—'}`} />
          </Box>
        </Section>
        <Section title="המשימות שלי להיום" side={todayTasks.length ? `${doneCount} מתוך ${todayTasks.length}` : undefined}>
          {todayTasks.length > 0 && (
            <div className="mx-1 mb-2.5 h-2.5 overflow-hidden rounded-full bg-line">
              <i className="block h-full rounded-full bg-[var(--kc)] transition-[width]" style={{ width: `${Math.round((doneCount / todayTasks.length) * 100)}%` }} />
            </div>
          )}
          <Box>
            {!todayTasks.length && <p className="py-6 text-center text-soft">אין משימות להיום 🎉</p>}
            {todayTasks.map((t) => <TaskRow key={t.id} task={t} />)}
          </Box>
        </Section>
      </>
    );
  } else if (tab === 'tasks') {
    body = (
      <>
        <Hero icon="⭐" title={`${member.stars} כוכבים`} subtitle={weekStars > 0 ? `השבוע אספת ${weekStars}` : 'כל משימה שמסמנים מוסיפה כוכבים'}>
          {nextReward && (
            <div className="mt-4 rounded-[18px] bg-white/20 px-3.5 py-3">
              <small className="block text-[13px] font-bold opacity-90">{nextReward.cost > member.stars ? 'הפרס הבא' : 'יש לך מספיק כוכבים!'}</small>
              <b className="text-[19px]">{nextReward.icon} {nextReward.title}{nextReward.cost > member.stars ? ` · עוד ${nextReward.cost - member.stars} כוכבים` : ''}</b>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/35">
                <i className="block h-full rounded-full bg-white transition-[width]" style={{ width: `${Math.min(100, Math.round((member.stars / nextReward.cost) * 100))}%` }} />
              </div>
            </div>
          )}
        </Hero>
        {rewards.length > 0 && (
          <Section title="הפרסים">
            <Box>
              {rewards.map((reward) => (
                <div key={reward.id} className="flex min-h-[64px] items-center gap-3 py-3">
                  <span className={`grid size-12 flex-none place-items-center rounded-2xl text-[26px] ${SOFT}`}>{reward.icon}</span>
                  <span className="min-w-0 flex-1"><b className="block text-[17px]">{reward.title}</b><small className="block text-[13px] font-bold text-soft">⭐ {reward.cost}</small></span>
                  {pendingReward(reward.id) ? (
                    <span className="whitespace-nowrap text-[13px] font-extrabold text-[var(--kc)]">ממתין לאישור</span>
                  ) : (
                    <button disabled={member.stars < reward.cost}
                      onClick={() => kidRequestReward(member, reward).then(() => toast('הבקשה נשלחה להורים')).catch((error: Error) => toast(`לא הצלחתי לשלוח: ${error.message}`))}
                      className="h-10 whitespace-nowrap rounded-[13px] bg-[var(--kc)] px-3.5 font-extrabold text-white disabled:bg-line disabled:text-soft">
                      {member.stars >= reward.cost ? 'אני רוצה!' : `עוד ${reward.cost - member.stars}`}
                    </button>
                  )}
                </div>
              ))}
            </Box>
          </Section>
        )}
        <Section title="היום"><Box>{todayTasks.length ? todayTasks.map((t) => <TaskRow key={t.id} task={t} />) : <p className="py-6 text-center text-soft">אין משימות להיום</p>}</Box></Section>
        {laterTasks.length > 0 && (
          <Section title="בהמשך">
            <Box>{laterTasks.map((t) => { const [y, m, d] = t.dueDate!.split('-').map(Number); return <TaskRow key={t.id} task={t} label={`יום ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`} />; })}</Box>
          </Section>
        )}
        <p className="px-1 pt-2 text-sm text-soft">ההורים רואים מה סימנת, ויכולים לבטל סימון. כשמבקשים פרס, ההורים מאשרים ואז הכוכבים יורדים.</p>
      </>
    );
  } else if (tab === 'week') {
    const week = buildWeek(now, { events: db.events, holidays, members: db.family_members, birthdays: db.birthdays, settings });
    const coming = week.filter((day) => day.offset >= 0).flatMap((day) => day.events.map((event) => ({ day, event }))).slice(0, 6);
    const birthday = upcomingBirthdays(db.family_members, db.birthdays, now, 1)[0];
    body = (
      <>
        <Hero icon="🗓" title="השבוע שלי" subtitle={`${week[0].shortDate}–${week[6].shortDate}`} />
        <Section title="החוגים שלי">
          <div className="grid grid-cols-7 gap-1.5">
            {week.map((day, i) => (
              <div key={day.date} className={`min-h-[76px] rounded-[14px] px-0.5 py-2 text-center text-sm font-bold shadow-[0_1px_0_var(--color-line)] ${day.offset === 0 ? 'bg-ink text-white' : 'bg-card'}`}>
                {day.name[0]}׳
                <small className="block text-[11px] opacity-65">{day.shortDate}</small>
                <span className="mt-1 block text-lg">{myActivities.filter((a) => a.weekday === i).map((a) => a.icon).join('')}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="מה קורה בבית">
          <Box>
            {coming.map(({ day, event }) => <Info key={day.date + event.key} icon="📌" label={day.offset === 0 ? 'היום' : day.offset === 1 ? 'מחר' : `יום ${day.name}`} value={event.title} />)}
            {birthday && birthday.days > 0 && <Info icon="🎂" label={`בעוד ${birthday.days} ימים`} value={`יום ההולדת של ${birthday.name}`} />}
            {!coming.length && !birthday && <p className="py-6 text-center text-soft">שבוע שקט</p>}
          </Box>
        </Section>
      </>
    );
  } else {
    body = <AskTab member={member} db={db} tomorrow={tomorrow} planned={meal(tomorrow, 'sandwich')} />;
  }

  return (
    <Shell>
      <main className="flex-1 overflow-y-auto px-4 pb-5" style={{ '--kc': member.color } as CSSProperties}>{body}</main>
      <nav aria-label="ניווט" className="grid grid-cols-4 border-t border-line bg-card px-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5" style={{ '--kc': member.color } as CSSProperties}>
        {TABS.map(([key, icon, label]) => (
          <button key={key} aria-current={key === tab ? 'page' : undefined} onClick={() => setTab(key)}
            className={`flex h-[58px] flex-col items-center justify-center rounded-2xl text-xs font-extrabold ${key === tab ? `${SOFT} text-[var(--kc)]` : 'text-soft'}`}>
            <span className="text-[22px] leading-tight">{icon}</span>{label}
          </button>
        ))}
      </nav>
      <Toaster />
    </Shell>
  );
}

function AskTab({ member, db, tomorrow, planned }: { member: FamilyMember; db: Database; tomorrow: string; planned: string }) {
  const options = menuHistory(db, 'sandwich', member.id).filter((o) => o !== planned).slice(0, 4);
  const [choice, setChoice] = useState('');
  const [item, setItem] = useState('');
  const [message, setMessage] = useState('');
  const sendMessage = (text: string) =>
    kidSendMessage(member, text).then(() => { setMessage(''); toast('ההודעה מוצגת במסך בבית'); }).catch((error: Error) => toast(`לא הצלחתי לשלוח: ${error.message}`));
  const request = db.meal_requests.find((r) => r.memberId === member.id && r.date === tomorrow);
  const STATUS = { pending: 'ממתין לתשובה מההורים', approved: 'אושר ✅', declined: 'לא הפעם' };

  const send = () =>
    kidRequestSandwich(member.id, tomorrow, choice).then(() => { setChoice(''); toast('הבקשה נשלחה להורים'); }).catch((error: Error) => toast(`לא הצלחתי לשלוח: ${error.message}`));
  const addItem = (event: FormEvent) => {
    event.preventDefault();
    if (!item.trim()) return;
    kidAddShopping(item, member.id).then(() => { setItem(''); toast('נוסף לרשימת הקניות'); }).catch((error: Error) => toast(`לא הצלחתי להוסיף: ${error.message}`));
  };

  return (
    <>
      <Hero icon="💬" title="בקשות" subtitle="ההורים מקבלים ומחליטים" />
      {member.getsSandwich && (
        <Section title="הכריך שלי למחר" side={planned || 'עוד לא נקבע'}>
          {request && <p className={`mb-2.5 rounded-2xl px-3.5 py-2.5 text-[15px] font-semibold ${SOFT}`}>ביקשת: <b>{request.text}</b> · {STATUS[request.status]}</p>}
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <button key={option} aria-pressed={choice === option} onClick={() => setChoice(option)}
                className={`h-11 rounded-[14px] border-2 px-3.5 font-bold shadow-[0_1px_0_var(--color-line)] ${choice === option ? `border-[var(--kc)] ${SOFT}` : 'border-transparent bg-card'}`}>
                {option}
              </button>
            ))}
          </div>
          <input value={choice} onChange={(e) => setChoice(e.target.value)} placeholder="או לכתוב משהו אחר" aria-label="כריך אחר"
            className="mt-2.5 h-[46px] w-full rounded-[14px] border-[1.5px] border-line bg-white px-3 font-semibold placeholder:font-medium placeholder:text-faint" />
          <button disabled={!choice.trim()} onClick={send} className="mt-2.5 h-12 w-full rounded-2xl bg-[var(--kc)] px-4 font-extrabold text-white disabled:opacity-50">שליחת בקשה</button>
        </Section>
      )}
      {db.settings[0].kidsCanMessage && (
        <Section title="הודעה למסך בבית">
          <div className="flex flex-wrap gap-2">
            {KID_MESSAGES.map((preset) => (
              <button key={preset} onClick={() => sendMessage(preset)} className="h-11 rounded-[14px] bg-card px-3.5 font-bold shadow-[0_1px_0_var(--color-line)]">{preset}</button>
            ))}
          </div>
          <form className="mt-2.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (message.trim()) void sendMessage(message); }}>
            <input value={message} maxLength={80} onChange={(e) => setMessage(e.target.value)} placeholder="או לכתוב הודעה" aria-label="הודעה למסך"
              className="h-[46px] min-w-0 flex-1 rounded-[14px] border-[1.5px] border-line bg-white px-3 font-semibold placeholder:font-medium placeholder:text-faint" />
            <button disabled={!message.trim()} className="h-[46px] rounded-[14px] bg-[var(--kc)] px-4 font-extrabold text-white disabled:opacity-50">שליחה</button>
          </form>
          <p className="px-1 pt-2 text-sm text-soft">ההודעה מופיעה במסך בבית לרבע שעה, עם השם שלך.</p>
        </Section>
      )}
      <Section title="להוסיף לרשימת הקניות">
        <form className="flex gap-2" onSubmit={addItem}>
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="מה חסר לי?" aria-label="פריט לקניות"
            className="h-[46px] min-w-0 flex-1 rounded-[14px] border-[1.5px] border-line bg-white px-3 font-semibold placeholder:font-medium placeholder:text-faint" />
          <button disabled={!item.trim()} className="h-[46px] rounded-[14px] bg-[var(--kc)] px-4 font-extrabold text-white disabled:opacity-50">הוספה</button>
        </form>
        <p className="px-1 pt-2 text-sm text-soft">הפריט נכנס לרשימה עם השם שלך.</p>
      </Section>
    </>
  );
}

/** מי הילד שהמסך שייך לו: לפי המכשיר המחובר בענן, או בחירה ידנית (להורה ולמצב מקומי). */
function KidResolver() {
  const db = useDatabase();
  const [memberId, setMemberId] = useState<string | null | undefined>(() => new URLSearchParams(window.location.search).get('member') ?? undefined);

  useEffect(() => {
    if (memberId !== undefined) return;
    if (store.mode !== 'cloud') return setMemberId(null);
    void (store as SupabaseStore).deviceMember().then(setMemberId).catch(() => setMemberId(null));
  }, [memberId]);

  const member = db.family_members.find((m) => m.id === memberId);
  if (member) return <KidApp member={member} db={db} />;
  if (memberId === undefined) return <Shell><p className="m-auto text-soft">טוען…</p></Shell>;

  const kids = [...db.family_members].sort((a, b) => a.sortOrder - b.sortOrder);
  const withDevice = kids.filter((m) => m.hasDevice);
  return (
    <Shell>
      <div className="m-auto w-full p-6 text-center">
        <h1 className="font-serif text-[28px] font-bold">של מי המסך?</h1>
        <p className="mb-5 mt-1 text-soft">תצוגה מקדימה להורים. מכשיר של ילד שחובר בסריקה נפתח ישר על המסך שלו.</p>
        <div className="flex flex-wrap justify-center gap-2.5">
          {(withDevice.length ? withDevice : kids).map((m) => (
            <button key={m.id} onClick={() => setMemberId(m.id)} className="h-12 rounded-2xl px-5 font-bold text-white" style={{ background: m.color }}>{m.name}</button>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function KidPage() {
  return store.mode === 'cloud' ? <ViewerGate kind="kid"><KidResolver /></ViewerGate> : <KidResolver />;
}
