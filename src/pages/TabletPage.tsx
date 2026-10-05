import { useEffect, useState, type CSSProperties } from 'react';
import { ViewerGate } from '../components/dashboard/ViewerGate';
import { Toaster, toast } from '../components/ui';
import { useDatabase } from '../hooks/useDatabase';
import { useNow } from '../hooks/useNow';
import { toISODate } from '../lib/dates';
import { tabletToggleRoutine, tabletToggleTask } from '../services/mutations';
import { store } from '../services/store';
import type { Database, FamilyMember } from '../types';

/** אחרי כמה זמן בלי נגיעה חוזרים למסך "מי אני?", כדי שהילד הבא לא יסמן אצל הקודם */
const IDLE_MS = 30_000;
/** עד הצהריים מוצגת רשימת הבוקר (אם הוגדרה), ואחר כך רשימת הערב */
const MORNING_UNTIL_HOUR = 12;

const GRADIENT = 'bg-[linear-gradient(150deg,color-mix(in_srgb,var(--kc)_80%,#1a1040),var(--kc)_60%,color-mix(in_srgb,var(--kc)_62%,#ffcf8a))]';
const SOFT = 'bg-[color-mix(in_srgb,var(--kc)_14%,white)]';
const kidColor = (member: FamilyMember) => ({ '--kc': member.color }) as CSSProperties;
const face = (member: FamilyMember) => member.icon || member.name[0];
const failed = (error: Error) => toast(`לא הצלחתי לשמור: ${error.message}`);

interface Entry {
  id: string;
  icon: string;
  text: string;
  note?: string;
  done: boolean;
  toggle: () => Promise<void>;
}

function useKidData(db: Database, period: 'evening' | 'morning', today: string) {
  return (member: FamilyMember) => {
    const routine: Entry[] = db.routine_items
      .filter((item) => item.memberId === member.id && item.period === period)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: item.id, icon: item.icon, text: item.text,
        done: db.routine_checks.some((c) => c.itemId === item.id && c.date === today),
        toggle: () => tabletToggleRoutine(item, today),
      }));
    const tasks: Entry[] = db.tasks
      .filter((t) => t.memberId === member.id && ((!t.done && (!t.dueDate || t.dueDate <= today)) || (t.done && t.completedAt !== null && toISODate(new Date(t.completedAt)) === today)))
      .map((task) => ({ id: task.id, icon: '⭐', text: task.title, note: `⭐ ${task.stars}`, done: task.done, toggle: () => tabletToggleTask(task) }));
    return { routine, tasks };
  };
}

/**
 * הטאבלט המשפחתי: מכשיר משותף לילדים שאין להם מכשיר משלהם. כל ילד נוגע בתמונה שלו
 * ומסמן את ההכנות והמשימות שלו בכפתורים גדולים, עם ציור וטקסט.
 */
function Tablet() {
  const db = useDatabase();
  const now = useNow();
  const [kidId, setKidId] = useState<string | null>(null);
  const [tab, setTab] = useState<'routine' | 'tasks'>('routine');
  const [touched, setTouched] = useState(0);

  const today = toISODate(now);
  const hasMorning = db.routine_items.some((item) => item.period === 'morning');
  const period = hasMorning && now.getHours() < MORNING_UNTIL_HOUR ? 'morning' : 'evening';
  const dataOf = useKidData(db, period, today);
  const kids = [...db.family_members]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    // הטאבלט מיועד למי שאין לו מכשיר משלו; ילד עם טלפון או טאבלט מדווח מהמסך האישי שלו
    .filter((m) => !m.hasDevice)
    .filter((m) => db.routine_items.some((item) => item.memberId === m.id) || db.tasks.some((t) => t.memberId === m.id && m.getsSandwich));

  // חזרה אוטומטית למסך הבחירה
  useEffect(() => {
    if (!kidId) return;
    const timer = window.setTimeout(() => setKidId(null), IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [kidId, touched]);

  const kid = kids.find((m) => m.id === kidId);
  if (!kid) {
    return (
      <div className="flex min-h-dvh flex-col bg-paper text-ink">
        <header className="px-[clamp(16px,4vw,40px)] pb-2 pt-[clamp(18px,4vw,36px)]">
          <h1 className="font-serif text-[clamp(30px,6vw,52px)] font-bold leading-tight">{period === 'evening' ? 'ערב טוב! מי מתכונן למחר?' : 'בוקר טוב! מי מוכן לצאת?'}</h1>
          <p className="mt-1 text-[clamp(18px,3vw,24px)] font-semibold text-soft">נוגעים בתמונה שלך</p>
        </header>
        <main className="grid flex-1 grid-cols-2 content-center gap-[clamp(12px,2.4vw,22px)] px-[clamp(16px,4vw,40px)] pb-[clamp(18px,4vw,40px)] pt-[clamp(12px,3vw,28px)] min-[900px]:grid-cols-4">
          {!kids.length && <p className="col-span-full text-center text-xl text-soft">אין כאן אף ילד עדיין. מופיעים כאן ילדים בלי מכשיר משלהם, שהוגדרו להם הכנות ב-Admin.</p>}
          {kids.map((member) => {
            const { routine } = dataOf(member);
            const ready = routine.length > 0 && routine.every((entry) => entry.done);
            return (
              <button key={member.id} aria-label={member.name} style={kidColor(member)} onClick={() => { setKidId(member.id); setTab('routine'); }}
                className={`flex min-h-[clamp(190px,30vh,280px)] flex-col items-center justify-center gap-2 rounded-[32px] px-4 py-[clamp(16px,3vw,28px)] text-white shadow-[0_14px_30px_color-mix(in_srgb,var(--kc)_35%,transparent)] transition-transform active:scale-95 ${GRADIENT}`}>
                <span className="relative grid size-[clamp(76px,12vw,108px)] place-items-center rounded-full border-4 border-white/70 bg-white/25 text-[clamp(40px,7vw,58px)] font-bold">
                  {face(member)}
                  {ready && <span className="absolute -bottom-2 -left-2 text-[34px]">{period === 'evening' ? '🌙' : '☀️'}</span>}
                </span>
                <b className="text-[clamp(30px,5vw,42px)] font-extrabold leading-tight">{member.name}</b>
                <span className="flex gap-[7px]">{routine.map((entry) => <i key={entry.id} className={`size-4 rounded-full border-[3px] border-white ${entry.done ? 'bg-white' : ''}`} />)}</span>
                <small className="rounded-full bg-black/20 px-3.5 py-0.5 text-lg font-extrabold">⭐ {member.stars}</small>
              </button>
            );
          })}
        </main>
        <Toaster />
      </div>
    );
  }

  const { routine, tasks } = dataOf(kid);
  const list = tab === 'routine' ? routine : tasks;
  const doneCount = list.filter((entry) => entry.done).length;
  const percent = list.length ? Math.round((doneCount / list.length) * 100) : 0;
  const marker = tab === 'tasks' ? '⭐' : period === 'evening' ? '🌙' : '☀️';

  return (
    <div className="min-h-dvh bg-paper text-ink" style={kidColor(kid)} onPointerDown={() => setTouched((n) => n + 1)}>
      <header className={`flex items-center gap-3.5 rounded-b-[32px] px-[clamp(16px,4vw,40px)] py-4 text-white ${GRADIENT}`}>
        <button onClick={() => setKidId(null)} className="h-16 rounded-[22px] bg-white/25 px-5 text-[22px] font-extrabold">‹ כולם</button>
        <span className="grid size-16 flex-none place-items-center rounded-full border-[3px] border-white/70 bg-white/25 text-[34px] font-bold">{face(kid)}</span>
        <h1 className="flex-1 font-serif text-[clamp(28px,5vw,40px)] font-bold leading-tight">{kid.name}</h1>
        <span className="whitespace-nowrap rounded-full bg-black/20 px-4 py-1.5 text-2xl font-extrabold">⭐ {kid.stars}</span>
      </header>

      <div className="grid grid-cols-2 gap-3 px-[clamp(16px,4vw,40px)] pb-1 pt-4">
        {([['routine', period === 'evening' ? '🌙 מתכוננים למחר' : '☀️ מתכוננים לבוקר'], ['tasks', '⭐ המשימות שלי']] as const).map(([key, label]) => (
          <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}
            className={`h-[72px] rounded-3xl border-4 text-[clamp(20px,3.4vw,26px)] font-extrabold shadow-[0_2px_0_var(--color-line)] ${tab === key ? `border-[var(--kc)] text-[var(--kc)] ${SOFT}` : 'border-transparent bg-card'}`}>
            {label}
          </button>
        ))}
      </div>

      {list.length > 0 && (
        <div className="relative mx-[clamp(16px,4vw,40px)] mb-1 mt-3.5 h-[22px] rounded-full bg-line">
          <i className="absolute inset-y-0 right-0 rounded-full bg-ok transition-[width] duration-500" style={{ width: `${percent}%` }} />
          <b className="absolute top-1/2 -translate-y-1/2 translate-x-1/2 text-[34px] transition-[right] duration-500" style={{ right: `${percent}%` }}>{marker}</b>
        </div>
      )}
      {list.length > 0 && doneCount === list.length && (
        <div className="mx-[clamp(16px,4vw,40px)] mt-1.5 rounded-[28px] bg-[linear-gradient(150deg,#1b2650,#3a2f6b)] p-5 text-center font-serif text-[clamp(26px,4.6vw,36px)] font-bold text-white">
          כל הכבוד, {kid.name}!
          <small className="mt-1 block font-sans text-lg font-bold opacity-85">{tab === 'routine' ? 'הכול מוכן' : 'סיימת את כל המשימות'}</small>
        </div>
      )}

      <main className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,330px),1fr))] gap-3.5 px-[clamp(16px,4vw,40px)] pb-7 pt-2.5">
        {!list.length && <p className="px-1 py-5 text-2xl text-soft">{tab === 'routine' ? 'אין הכנות ברשימה' : 'אין משימות להיום 🎉'}</p>}
        {list.map((entry) => (
          <button key={entry.id} aria-pressed={entry.done} onClick={() => entry.toggle().catch(failed)}
            className={`flex min-h-[104px] items-center gap-4 rounded-[28px] border-4 px-[18px] py-3.5 text-start shadow-[0_3px_0_var(--color-line),0_10px_24px_rgba(60,40,10,.06)] transition-transform active:scale-[.97] ${entry.done ? 'border-ok bg-[#e8f6ef]' : 'border-transparent bg-card'}`}>
            <span className={`grid size-[76px] flex-none place-items-center rounded-3xl text-[46px] ${SOFT}`}>{entry.icon}</span>
            <span className={`min-w-0 flex-1 text-[clamp(24px,4vw,30px)] font-extrabold leading-tight ${entry.done ? 'text-[#2c6f58]' : ''}`}>
              {entry.text}
              {entry.note && <small className="block text-[17px] font-bold text-soft">{entry.note}</small>}
            </span>
            <span className={`grid size-[60px] flex-none place-items-center rounded-full border-[5px] text-[34px] transition-colors ${entry.done ? 'border-ok bg-ok text-white' : 'border-faint text-transparent'}`}>✓</span>
          </button>
        ))}
      </main>
      <Toaster />
    </div>
  );
}

export function TabletPage() {
  return store.mode === 'cloud' ? <ViewerGate kind="shared"><Tablet /></ViewerGate> : <Tablet />;
}
