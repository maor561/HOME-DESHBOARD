import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { store } from '../../services/store';
import type { Access, SupabaseStore } from '../../services/supabaseStore';

/**
 * קצב הבדיקה אם המסך כבר אושר. מהיר בדקות הראשונות (כשמישהו עומד מול המסך עם הטלפון),
 * ואז מאט, כדי שמסך שנשאר על קוד ה-QR לא ישלח עשרות אלפי בקשות ביום.
 */
function pollDelay(startedAt: number): number {
  const waited = Date.now() - startedAt;
  if (waited < 2 * 60_000) return 3_000;
  if (waited < 15 * 60_000) return 15_000;
  return 60_000;
}

/** קוד קצר שמופיע גם במסך וגם בטלפון, כדי לוודא שמאשרים את המסך הנכון. */
export const pairCode = (userId: string): string => String(parseInt(userId.replace(/-/g, '').slice(0, 8), 16) % 10000).padStart(4, '0');

function QrCode({ value }: { value: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
    return { size: count, path: d };
  }, [value]);
  return (
    <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} role="img" aria-label="קוד QR לחיבור המסך" className="h-full w-full rounded-[4%] bg-white" shapeRendering="crispEdges">
      <path d={path} fill="#12233d" />
    </svg>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return <main className="admin-sky grid h-dvh place-items-center p-[4vmin] text-center text-white">{children}</main>;
}

/**
 * שער הצפייה במצב ענן. מסך שעוד לא אושר מציג קוד QR; סורקים אותו בטלפון,
 * מתחברים שם ומאשרים, והמסך נפתח לבד. כך אין צורך להקליד סיסמה בטלוויזיה.
 */
export function ViewerGate({ children }: { children: ReactNode }) {
  const cloud = store as SupabaseStore;
  const [access, setAccess] = useState<Access | 'loading' | 'error'>('loading');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const startedAt = Date.now();
    const again = () => {
      timer = window.setTimeout(check, pollDelay(startedAt));
    };

    const check = async () => {
      // לשונית ברקע: לא שולחים בקשות, רק בודקים שוב מאוחר יותר
      if (document.hidden) return again();
      try {
        // קודם בודקים עם מה שיש; משתמש אנונימי נוצר רק כשבאמת צריך לחבר מסך
        let session = await cloud.getSession();
        let next = await cloud.checkAccess(session);
        if (next === 'none' && !session) {
          session = await cloud.ensureSession().catch(() => null);
          next = await cloud.checkAccess(session);
        }
        if (cancelled) return;
        if (session) setUserId(session.user.id);
        if (next !== 'none') await cloud.reload().catch(() => {});
        if (cancelled) return;
        // בלי משתמש אנונימי אי אפשר לחבר מסך: כנראה שהאפשרות כבויה ב-Supabase
        setAccess(next === 'none' && !session ? 'error' : next);
        if (next === 'none') again();
      } catch {
        if (!cancelled) again();
      }
    };
    void check();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cloud]);

  if (access === 'admin' || access === 'device' || access === 'open') return <>{children}</>;
  if (access === 'loading') return <Screen><p className="text-[3vmin] opacity-80">טוען…</p></Screen>;
  if (access === 'error') {
    return (
      <Screen>
        <div>
          <h1 className="font-serif text-[6vmin] font-bold">אי אפשר לחבר את המסך</h1>
          <p className="mt-[2vmin] text-[3vmin] opacity-85">צריך להפעיל ב-Supabase את האפשרות Anonymous sign-ins.</p>
        </div>
      </Screen>
    );
  }

  const url = `${window.location.origin}/admin?pair=${userId}`;
  return (
    <Screen>
      <div className="flex flex-wrap items-center justify-center gap-[6vmin]">
        <div className="size-[46vmin]"><QrCode value={url} /></div>
        <div className="max-w-[60vmin] text-start">
          <h1 className="font-serif text-[7vmin] font-bold leading-tight">חיבור המסך</h1>
          <ol className="mt-[2.5vmin] list-decimal ps-[4vmin] text-[3.2vmin] leading-relaxed opacity-90">
            <li>סרקו את הקוד במצלמת הטלפון</li>
            <li>התחברו עם המייל והסיסמה</li>
            <li>ודאו שהקוד זהה ואשרו</li>
          </ol>
          <p className="mt-[3vmin] text-[3vmin] opacity-80">קוד המסך</p>
          <p className="font-serif text-[11vmin] font-bold leading-none tracking-[0.12em]" dir="ltr">{pairCode(userId)}</p>
        </div>
      </div>
    </Screen>
  );
}
