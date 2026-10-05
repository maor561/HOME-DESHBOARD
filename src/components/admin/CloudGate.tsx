import type { Session } from '@supabase/supabase-js';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { createSeed } from '../../data/seed';
import { useDatabase } from '../../hooks/useDatabase';
import { navigate } from '../../hooks/useRoute';
import { readLocalDatabase, store } from '../../services/store';
import type { Access, SupabaseStore } from '../../services/supabaseStore';
import { pairCode } from '../dashboard/ViewerGate';

const FIELD = 'h-12 w-full rounded-2xl border-0 bg-white/90 px-4 font-semibold text-ink placeholder:text-soft';
const ACTION = 'h-12 rounded-2xl bg-white font-bold text-accent disabled:opacity-60';

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh bg-[#1b1d27]">
      <div className="admin-sky mx-auto flex h-full max-w-[430px] flex-col justify-center gap-4 p-7 text-white">{children}</div>
    </div>
  );
}

/** מזהה המסך שממתין לאישור, כשהגענו לכאן מסריקת קוד ה-QR שלו. */
const pendingDevice = () => new URLSearchParams(window.location.search).get('pair');
const pendingKind = (): 'screen' | 'kid' | 'shared' => {
  const kind = new URLSearchParams(window.location.search).get('kind');
  return kind === 'kid' || kind === 'shared' ? kind : 'screen';
};

/**
 * שער הכניסה ל-Admin במצב ענן: התחברות במייל וסיסמה, אישור מסך שנסרק,
 * והעלאה ראשונית של הנתונים כשהענן ריק.
 */
export function CloudGate({ children }: { children: (signOut: () => void) => ReactNode }) {
  const cloud = store as SupabaseStore;
  const db = useDatabase();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [access, setAccess] = useState<Access | null>(null);
  const [device, setDevice] = useState(pendingDevice);
  const [kind] = useState(pendingKind);
  const [kidId, setKidId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void cloud.getSession().then(setSession);
    const { data } = cloud.client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [cloud]);

  // משתמש אנונימי (מסך שנפתח פעם בדפדפן הזה) אינו מנהל: מציגים לו את מסך ההתחברות
  const signedIn = session && !session.user.is_anonymous ? session : null;

  useEffect(() => {
    setAccess(null);
    if (!signedIn) return;
    let cancelled = false;
    void cloud.checkAccess(signedIn).then(async (next) => {
      if (next !== 'none') await cloud.reload().catch(() => {});
      if (!cancelled) setAccess(next);
    });
    return () => {
      cancelled = true;
    };
  }, [cloud, signedIn?.user.id]);

  const run = async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(`${failure}: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await cloud.client.auth.signInWithPassword({ email, password });
    setBusy(false);
    setMessage(error ? 'המייל או הסיסמה שגויים' : '');
  };

  const closePairing = () => {
    setDevice(null);
    navigate('/admin');
  };

  if (session === undefined || (signedIn && access === null)) return <Frame><p className="text-center opacity-80">טוען…</p></Frame>;

  if (!signedIn) {
    return (
      <Frame>
        <h1 className="text-center font-serif text-[34px] font-bold">{device ? 'חיבור מסך' : 'ניהול המסך'}</h1>
        {device && <p className="-mt-2 text-center opacity-85">התחברו כדי לאשר את המסך</p>}
        <form className="flex flex-col gap-3" onSubmit={signIn}>
          <input className={FIELD} type="email" autoComplete="username" placeholder="מייל" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className={FIELD} type="password" autoComplete="current-password" placeholder="סיסמה" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className={ACTION} disabled={busy}>{busy ? 'מתחבר…' : 'כניסה'}</button>
        </form>
        {message && <p role="alert" className="text-center font-semibold">{message}</p>}
      </Frame>
    );
  }

  if (access === 'none') {
    return (
      <Frame>
        <h1 className="text-center font-serif text-[30px] font-bold">אין הרשאת ניהול</h1>
        <p className="text-center opacity-85">המשתמש הזה אינו מוגדר כמנהל של המסך.</p>
        <button className={ACTION} onClick={() => void cloud.client.auth.signOut()}>התנתקות</button>
      </Frame>
    );
  }

  if (device) {
    const sorted = [...db.family_members].sort((a, b) => a.sortOrder - b.sortOrder);
    const candidates = sorted.some((m) => m.hasDevice) ? sorted.filter((m) => m.hasDevice) : sorted;
    const kid = db.family_members.find((m) => m.id === kidId);
    const approve = () =>
      cloud.approveDevice(device, kind === 'kid' ? `המסך של ${kid?.name}` : kind === 'shared' ? 'הטאבלט המשפחתי' : 'מסך הבית', kind === 'kid' ? kidId : null, kind);
    return (
      <Frame>
        <h1 className="text-center font-serif text-[30px] font-bold">{kind === 'kid' ? 'חיבור מסך של ילד' : kind === 'shared' ? 'חיבור הטאבלט המשפחתי' : 'לחבר את המסך הזה?'}</h1>
        <p className="text-center opacity-85">ודאו שזה הקוד שמופיע על המסך:</p>
        <p className="text-center font-serif text-[64px] font-bold leading-none tracking-[0.12em]" dir="ltr">{pairCode(device)}</p>
        {kind === 'kid' && (
          <>
            <p className="text-center opacity-85">של מי המכשיר?</p>
            <div className="flex flex-wrap justify-center gap-2">
              {candidates.map((m) => (
                <button key={m.id} aria-pressed={kidId === m.id} onClick={() => setKidId(m.id)}
                  className={`h-11 rounded-2xl px-4 font-bold ${kidId === m.id ? 'bg-white text-accent' : 'bg-white/20'}`}>{m.name}</button>
              ))}
            </div>
          </>
        )}
        <button className={ACTION} disabled={busy || (kind === 'kid' && !kidId)} onClick={() => run(async () => { await approve(); closePairing(); }, 'החיבור נכשל')}>
          {busy ? 'מחבר…' : 'אישור וחיבור'}
        </button>
        <button className="h-11 font-bold underline underline-offset-4" onClick={closePairing}>ביטול</button>
        {message && <p role="alert" className="text-center font-semibold">{message}</p>}
      </Frame>
    );
  }

  if (!db.settings.length) {
    const hasLocal = readLocalDatabase() !== null;
    return (
      <Frame>
        <h1 className="text-center font-serif text-[30px] font-bold">הענן עדיין ריק</h1>
        <p className="text-center opacity-85">
          {hasLocal ? 'נמצאו נתונים שהוזנו במכשיר הזה. אפשר להעלות אותם לענן.' : 'אפשר להתחיל מנתוני הפתיחה ולעדכן אותם אחר כך.'}
        </p>
        <button className={ACTION} disabled={busy} onClick={() => run(() => cloud.importDatabase(readLocalDatabase() ?? createSeed()), 'ההעלאה נכשלה')}>
          {busy ? 'מעלה…' : hasLocal ? 'העלאת הנתונים מהמכשיר הזה' : 'התחלה מנתוני הפתיחה'}
        </button>
        {message && <p role="alert" className="text-center font-semibold">{message}</p>}
      </Frame>
    );
  }

  return <>{children(() => void cloud.client.auth.signOut())}</>;
}
