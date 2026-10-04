import { CalendarDays, Delete, Home, LayoutGrid, ListChecks, Utensils, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ActivitiesScreen } from '../components/admin/ActivitiesScreen';
import { CalendarScreen } from '../components/admin/CalendarScreen';
import { HomeScreen } from '../components/admin/HomeScreen';
import { MenuScreen } from '../components/admin/MenuScreen';
import { MessagesScreen } from '../components/admin/MessagesScreen';
import { BirthdaysScreen, FamilyScreen, MoreScreen, PhotosScreen, QuotesScreen } from '../components/admin/MoreScreens';
import { RewardsScreen } from '../components/admin/RewardsScreen';
import { SettingsScreen } from '../components/admin/SettingsScreen';
import { ShoppingScreen } from '../components/admin/ShoppingScreen';
import { TasksScreen } from '../components/admin/TasksScreen';
import type { Screen } from '../components/admin/shared';
import { Toaster } from '../components/ui';
import { CloudGate } from '../components/admin/CloudGate';
import { useDatabase } from '../hooks/useDatabase';
import { store } from '../services/store';

const TABS: [Screen, LucideIcon, string][] = [
  ['home', Home, 'בית'],
  ['menu', Utensils, 'תפריט'],
  ['acts', CalendarDays, 'חוגים'],
  ['tasks', ListChecks, 'משימות'],
  ['more', LayoutGrid, 'עוד'],
];
const UNLOCK_KEY = 'cohen-admin-unlocked';

/**
 * נעילת PIN. זו הגנה בסיסית לשלב המקומי בלבד: הקוד נבדק בדפדפן.
 * בחיבור לענן היא תוחלף בהתחברות אמיתית (Supabase Auth).
 */
function PinLock({ pin, familyName, onUnlock }: { pin: string; familyName: string; onUnlock: () => void }) {
  const [entry, setEntry] = useState('');
  const [wrong, setWrong] = useState(false);

  const press = (key: string) => {
    const next = key === 'back' ? entry.slice(0, -1) : (entry + key).slice(0, 4);
    setEntry(next);
    setWrong(false);
    if (next.length < 4) return;
    if (next === pin) return onUnlock();
    setWrong(true);
    window.setTimeout(() => setEntry(''), 500);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (/^\d$/.test(e.key) ? press(e.key) : e.key === 'Backspace' && press('back'));
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="admin-sky absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 text-white">
      <h1 className="font-serif text-[34px] font-bold">{familyName}</h1>
      <p className="-mt-3 opacity-85" role="status">{wrong ? 'קוד שגוי, נסו שוב' : 'הקישו קוד כדי לנהל את המסך'}</p>
      <div className="flex gap-3.5" dir="ltr">
        {[0, 1, 2, 3].map((i) => <i key={i} className={`size-4 rounded-full border-2 border-white ${i < entry.length ? 'bg-white' : ''}`} />)}
      </div>
      <div className="grid grid-cols-[repeat(3,72px)] gap-3.5" dir="ltr">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key) =>
          key === '' ? <span key="spacer" /> : (
            <button key={key} aria-label={key === 'back' ? 'מחיקה' : key} onClick={() => press(key)} className="grid size-[72px] place-items-center rounded-full bg-white/15 font-serif text-[28px] active:bg-white/35">
              {key === 'back' ? <Delete className="size-6" /> : key}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

/** מסך הניהול, מותאם לטלפון. כל שינוי נשמר מיד ומתעדכן במסך שבבית. */
export function AdminPage() {
  // בענן ההגנה היא התחברות אמיתית; במצב מקומי קוד PIN
  return store.mode === 'cloud' ? <CloudGate>{(signOut) => <AdminShell onLock={signOut} />}</CloudGate> : <PinGate />;
}

function PinGate() {
  const db = useDatabase();
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === '1');
  const unlock = () => {
    sessionStorage.setItem(UNLOCK_KEY, '1');
    setUnlocked(true);
  };
  const lock = () => {
    sessionStorage.removeItem(UNLOCK_KEY);
    setUnlocked(false);
  };
  if (unlocked) return <AdminShell onLock={lock} />;
  return (
    <div className="h-dvh bg-[#1b1d27] text-ink">
      <div className="relative mx-auto h-full max-w-[430px] overflow-hidden bg-paper">
        <PinLock pin={db.settings[0].pin} familyName={db.families[0]?.name ?? ''} onUnlock={unlock} />
      </div>
    </div>
  );
}

function AdminShell({ onLock }: { onLock: () => void }) {
  const [screen, setScreen] = useState<Screen>('home');
  const scroller = useRef<HTMLElement>(null);
  const tab = TABS.some(([key]) => key === screen) ? screen : 'more';

  const go = (next: Screen) => {
    setScreen(next);
    scroller.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="h-dvh bg-[#1b1d27] text-ink">
      <div className="relative mx-auto flex h-full max-w-[430px] flex-col overflow-hidden bg-paper">
        {(
          <>
            <main ref={scroller} className="flex-1 overflow-y-auto px-4 pb-6">
              {screen === 'home' && <HomeScreen go={go} />}
              {screen === 'menu' && <MenuScreen />}
              {screen === 'acts' && <ActivitiesScreen />}
              {screen === 'tasks' && <TasksScreen />}
              {screen === 'more' && <MoreScreen go={go} onLock={onLock} />}
              {screen === 'msg' && <MessagesScreen />}
              {screen === 'rewards' && <RewardsScreen go={go} />}
              {screen === 'shop' && <ShoppingScreen />}
              {screen === 'cal' && <CalendarScreen go={go} />}
              {screen === 'family' && <FamilyScreen go={go} />}
              {screen === 'bdays' && <BirthdaysScreen go={go} />}
              {screen === 'quotes' && <QuotesScreen go={go} />}
              {screen === 'photos' && <PhotosScreen go={go} />}
              {screen === 'settings' && <SettingsScreen go={go} />}
            </main>
            <nav aria-label="ניווט" className="grid grid-cols-5 border-t border-line bg-card px-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5">
              {TABS.map(([key, Icon, label]) => (
                <button key={key} aria-current={key === tab ? 'page' : undefined} onClick={() => go(key)}
                  className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] text-xs font-bold ${key === tab ? 'bg-accent-soft text-accent' : 'text-soft'}`}>
                  <Icon className="size-5" />
                  {label}
                </button>
              ))}
            </nav>
          </>
        )}
        <Toaster />
      </div>
    </div>
  );
}
