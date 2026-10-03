import type { Session } from '@supabase/supabase-js';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { createSeed } from '../../data/seed';
import { useDatabase } from '../../hooks/useDatabase';
import { readLocalDatabase, store } from '../../services/store';
import { SupabaseStore } from '../../services/supabaseStore';

const FIELD = 'h-12 w-full rounded-2xl border-0 bg-white/90 px-4 font-semibold text-ink placeholder:text-soft';

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh bg-[#1b1d27]">
      <div className="admin-sky mx-auto flex h-full max-w-[430px] flex-col justify-center gap-4 p-7 text-white">{children}</div>
    </div>
  );
}

/** שער הכניסה ל-Admin במצב ענן: התחברות במייל וסיסמה, והעלאה ראשונית של הנתונים כשהענן ריק. */
export function CloudGate({ children }: { children: (signOut: () => void) => ReactNode }) {
  const cloud = store as SupabaseStore;
  const db = useDatabase();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void cloud.getSession().then(setSession);
    const { data } = cloud.client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [cloud]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await cloud.client.auth.signInWithPassword({ email, password });
    setBusy(false);
    setMessage(error ? 'המייל או הסיסמה שגויים' : '');
  };

  const importData = async () => {
    setBusy(true);
    try {
      await cloud.importDatabase(readLocalDatabase() ?? createSeed());
      setMessage('');
    } catch (error) {
      setMessage(`ההעלאה נכשלה: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (session === undefined) return <Frame><p className="text-center opacity-80">טוען…</p></Frame>;

  if (!session) {
    return (
      <Frame>
        <h1 className="text-center font-serif text-[34px] font-bold">ניהול המסך</h1>
        <form className="flex flex-col gap-3" onSubmit={signIn}>
          <input className={FIELD} type="email" autoComplete="username" placeholder="מייל" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className={FIELD} type="password" autoComplete="current-password" placeholder="סיסמה" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="h-12 rounded-2xl bg-white font-bold text-accent disabled:opacity-60" disabled={busy}>{busy ? 'מתחבר…' : 'כניסה'}</button>
        </form>
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
        <button className="h-12 rounded-2xl bg-white font-bold text-accent disabled:opacity-60" disabled={busy} onClick={importData}>
          {busy ? 'מעלה…' : hasLocal ? 'העלאת הנתונים מהמכשיר הזה' : 'התחלה מנתוני הפתיחה'}
        </button>
        {message && <p role="alert" className="text-center font-semibold">{message}</p>}
      </Frame>
    );
  }

  return <>{children(() => void cloud.client.auth.signOut())}</>;
}
