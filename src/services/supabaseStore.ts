import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, ID, Row, TableName } from '../types';

/** מה מותר למשתמש המחובר: ניהול, צפייה כמסך מאושר, או כלום */
export type Access = 'admin' | 'device' | 'none' | 'open';

export interface PairedDevice {
  userId: string;
  name: string;
  /** בן המשפחה שהמכשיר שייך לו; null למסך הבית */
  memberId: string | null;
  createdAt: string;
}
import { normalize, type DataStore } from './store';

export interface CloudConfig {
  url: string;
  anonKey: string;
}

// שמות המשתנים: ידני (VITE_) או כפי שהחיבור של Supabase דרך Vercel מגדיר אותם (NEXT_PUBLIC_)
const env = import.meta.env as Record<string, string | undefined>;
const url = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfig: CloudConfig | null = url && anonKey ? { url, anonKey } : null;

const TABLES: TableName[] = ['families', 'family_members', 'birthdays', 'activities', 'meals', 'tasks', 'daily_quotes', 'photos', 'events', 'shopping_items', 'meal_requests', 'settings'];
const CACHE_KEY = 'cohen-dashboard-cloud-cache-v1';
const PHOTO_BUCKET = 'photos';
/** רשת ביטחון בלבד: העדכונים השוטפים מגיעים ב-Realtime, בחיבור אחד פתוח ובלי בקשות חוזרות */
const REFRESH_MS = 15 * 60_000;
/** לא טוענים מחדש יותר מפעם בדקה כשחוזרים ללשונית */
const MIN_RELOAD_GAP_MS = 60_000;

const EMPTY: Database = { families: [], family_members: [], birthdays: [], activities: [], meals: [], tasks: [], daily_quotes: [], photos: [], events: [], shopping_items: [], meal_requests: [], settings: [] };

type Json = Record<string, unknown>;
const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const mapKeys = (row: Json, fn: (key: string) => string): Json => Object.fromEntries(Object.entries(row).map(([k, v]) => [fn(k), v]));

/** שורה מהאפליקציה לשורת טבלה (snake_case). קוד ה-PIN לא נשמר בענן. */
function toRow(table: TableName, row: Json): Json {
  const { pin: _pin, ...rest } = row;
  return mapKeys(table === 'settings' ? rest : row, snake);
}

function fromRow<T extends TableName>(table: T, row: Json): Row<T> {
  const mapped = mapKeys(row, camel);
  return (table === 'settings' ? { ...mapped, pin: '' } : mapped) as unknown as Row<T>;
}

/** אחסון בענן (Supabase): PostgreSQL לנתונים, Realtime לעדכון מיידי, Storage לתמונות. */
export class SupabaseStore implements DataStore {
  readonly mode = 'cloud';
  readonly client: SupabaseClient;
  private db: Database = EMPTY;
  private listeners = new Set<() => void>();
  private lastReload = 0;
  private userId: string | null = null;
  private listenTurn = 0;

  constructor(config: CloudConfig) {
    this.client = createClient(config.url, config.anonKey);
  }

  async init(): Promise<void> {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) this.db = { ...EMPTY, ...(JSON.parse(cached) as Database) };
    } catch {
      // מטמון פגום: ממשיכים לטעינה מהענן
    }
    await this.reload().catch((error) => console.warn('טעינת הנתונים מהענן נכשלה, מוצג המטמון', error));
    this.userId = (await this.getSession())?.user.id ?? null;
    void this.listen();

    // כשהמשתמש מתחלף (כניסה, יציאה, אישור מסך) ההרשאות משתנות: מתחברים מחדש לעדכונים וטוענים שוב.
    // Supabase שולח אירוע SIGNED_IN גם בכל חזרה ללשונית ובכל חידוש אסימון; אלה לא משנים דבר, ולכן מתעלמים מהם.
    this.client.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null;
      if (userId === this.userId) return;
      this.userId = userId;
      // setTimeout: אסור לקרוא ל-Supabase מתוך ה-callback עצמו
      window.setTimeout(() => {
        void this.listen();
        void this.reload().catch(() => {});
      }, 0);
    });

    // רשת ביטחון למקרה שהחיבור החי נפל: רענון מלא מדי כמה דקות וכשחוזרים ללשונית
    window.setInterval(() => this.refreshIfVisible(REFRESH_MS / 2), REFRESH_MS);
    document.addEventListener('visibilitychange', () => this.refreshIfVisible(MIN_RELOAD_GAP_MS));
  }

  getSnapshot = (): Database => this.db;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async upsert<T extends TableName>(table: T, row: Row<T>): Promise<void> {
    this.apply(table, row);
    const { error } = await this.client.from(table).upsert(toRow(table, row as unknown as Json));
    if (error) await this.fail(error.message);
  }

  async remove(table: TableName, id: ID): Promise<void> {
    const removed = (this.db[table] as { id: ID; url?: string }[]).find((r) => r.id === id);
    this.apply(table, null, id);
    const { error } = await this.client.from(table).delete().eq('id', id);
    if (error) await this.fail(error.message);
    if (table === 'photos' && removed?.url) await this.deletePhotoFile(removed.url);
  }

  async uploadPhoto(image: Blob): Promise<string> {
    const path = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await this.client.storage.from(PHOTO_BUCKET).upload(path, image, { contentType: 'image/jpeg' });
    if (error) throw new Error(error.message);
    return this.client.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async reset(): Promise<void> {
    throw new Error('איפוס זמין רק במצב מקומי');
  }

  /** רענון מלא, רק כשהלשונית גלויה ורק אם עבר מספיק זמן מהטעינה הקודמת. */
  private refreshIfVisible(minGapMs: number): void {
    if (document.hidden || Date.now() - this.lastReload < minGapMs) return;
    void this.reload().catch(() => {});
  }

  /** האזנה לשינויים בזמן אמת. נקראת מחדש כשהמשתמש מתחלף, כדי שההרשאות החדשות יחולו. */
  private async listen(): Promise<void> {
    const turn = ++this.listenTurn;
    // חייבים לחכות לסגירה: אחרת הסגירה של הערוץ הישן מנתקת גם את הערוץ החדש
    await this.client.removeAllChannels();
    if (turn !== this.listenTurn) return;
    this.client
      .channel('cohen-db')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const table = payload.table as TableName;
        if (!TABLES.includes(table)) return;
        if (payload.eventType === 'DELETE') this.apply(table, null, (payload.old as { id: ID }).id);
        else this.apply(table, fromRow(table, payload.new as Json));
      })
      .subscribe();
  }

  /* ---------- הרשאות צפייה וחיבור מסכים ---------- */

  /** מסך שעוד אין לו זהות מקבל משתמש אנונימי, שאותו מאשרים מהטלפון. */
  async ensureSession(): Promise<Session> {
    const existing = await this.getSession();
    if (existing) return existing;
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error || !data.session) throw new Error(error?.message ?? 'anonymous sign-in failed');
    return data.session;
  }

  /**
   * בודק מה מותר למשתמש הנוכחי. 'open' מוחזר כשטבלאות ההרשאות עוד לא הותקנו
   * במסד הנתונים, ואז המערכת מתנהגת כמו קודם (צפייה פתוחה).
   */
  async checkAccess(session: Session | null): Promise<Access> {
    // בקשה אחת לכל בדיקה: אותה שאילתה גם מגלה אם טבלאות ההרשאות קיימות
    const table = session && !session.user.is_anonymous ? 'admins' : 'devices';
    const query = this.client.from(table).select('user_id');
    const { data, error } = await (session ? query.eq('user_id', session.user.id) : query).limit(1);
    if (error && /does not exist|not find|schema cache/i.test(error.message)) return 'open';
    if (!session || !data?.length) return 'none';
    return table === 'admins' ? 'admin' : 'device';
  }

  async approveDevice(deviceUserId: string, name: string, memberId: string | null = null): Promise<void> {
    const session = await this.getSession();
    const row: Json = { user_id: deviceUserId, name, approved_by: session?.user.id };
    // העמודה קיימת רק אחרי סקריפט העדכון השלישי; למסך הבית לא שולחים אותה כלל
    if (memberId) row.member_id = memberId;
    const { error } = await this.client.from('devices').upsert(row);
    if (error) throw new Error(error.message);
  }

  async listDevices(): Promise<PairedDevice[]> {
    const { data, error } = await this.client.from('devices').select('*').order('created_at');
    if (error) return [];
    return (data as { user_id: string; name: string; member_id?: string | null; created_at: string }[]).map((d) => ({ userId: d.user_id, name: d.name, memberId: d.member_id ?? null, createdAt: d.created_at }));
  }

  /** בן המשפחה שהמכשיר הנוכחי מחובר בשמו, או null אם זה מסך הבית או שהמכשיר לא מחובר. */
  async deviceMember(): Promise<string | null> {
    const session = await this.getSession();
    if (!session) return null;
    const { data } = await this.client.from('devices').select('*').eq('user_id', session.user.id).limit(1);
    return (data?.[0] as { member_id?: string | null } | undefined)?.member_id ?? null;
  }

  async removeDevice(deviceUserId: string): Promise<void> {
    const { error } = await this.client.from('devices').delete().eq('user_id', deviceUserId);
    if (error) throw new Error(error.message);
  }

  /** העלאה ראשונית של נתונים קיימים (למשל מהמצב המקומי) לענן ריק. דורש משתמש מחובר. */
  async importDatabase(source: Database): Promise<void> {
    for (const table of TABLES) {
      // תמונות מקומיות נשמרו כ-data URL ואינן עוברות לענן: מעלים אותן מחדש מהטלפון
      const rows = (source[table] as unknown as Json[]).filter((row) => table !== 'photos' || !String(row.url).startsWith('data:'));
      if (!rows.length) continue;
      const { error } = await this.client.from(table).upsert(rows.map((row) => toRow(table, row)));
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    await this.reload();
  }

  getSession = async (): Promise<Session | null> => (await this.client.auth.getSession()).data.session;

  async reload(): Promise<void> {
    this.lastReload = Date.now();
    const results = await Promise.all(TABLES.map((table) => this.client.from(table).select('*')));
    const next = { ...EMPTY } as Record<TableName, unknown[]>;
    results.forEach(({ data, error }, i) => {
      // טבלה שעוד לא נוצרה במסד הנתונים (לפני הרצת סקריפט העדכון) נחשבת ריקה
      if (error && /does not exist|not find|schema cache/i.test(error.message)) return;
      if (error) throw new Error(`${TABLES[i]}: ${error.message}`);
      next[TABLES[i]] = (data as Json[]).map((row) => fromRow(TABLES[i], row));
    });
    const loaded = next as unknown as Database;
    // ענן ריק נשאר ריק (כדי שיוצע להעלות נתונים); אחרת משלימים שדות חסרים
    this.commit(loaded.settings.length ? normalize(loaded) : loaded);
  }

  /** עדכון של שורה אחת בתמונת המצב המקומית: row להוספה/עדכון, או removeId למחיקה. */
  private apply<T extends TableName>(table: T, row: Row<T> | null, removeId?: ID): void {
    const rows = this.db[table] as Row<T>[];
    let next: Row<T>[];
    if (row) next = rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row];
    else next = rows.filter((r) => r.id !== removeId);
    this.commit({ ...this.db, [table]: next });
  }

  private commit(next: Database): void {
    this.db = next;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {
      // המטמון הוא רק לפתיחה מהירה; אפשר בלעדיו
    }
    this.listeners.forEach((listener) => listener());
  }

  /** כתיבה שנכשלה: חוזרים למצב האמיתי שבענן ומדווחים למסך. */
  private async fail(message: string): Promise<never> {
    await this.reload().catch(() => {});
    throw new Error(message);
  }

  private async deletePhotoFile(publicUrl: string): Promise<void> {
    const marker = `/${PHOTO_BUCKET}/`;
    const index = publicUrl.indexOf(marker);
    if (index === -1) return;
    await this.client.storage.from(PHOTO_BUCKET).remove([publicUrl.slice(index + marker.length)]);
  }
}
