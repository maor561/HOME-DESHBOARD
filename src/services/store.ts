import { WIDGETS, createSeed } from '../data/seed';
import type { Database, ID, Row, TableName } from '../types';
import { SupabaseStore, cloudConfig } from './supabaseStore';

/**
 * שכבת הנתונים. כל המסכים עובדים מול הממשק הזה בלבד: LocalStore שומר בדפדפן,
 * SupabaseStore שומר בענן ומסנכרן בין מכשירים בזמן אמת.
 */
export interface DataStore {
  readonly mode: 'local' | 'cloud';
  /** טעינה ראשונית. נקראת פעם אחת לפני שהאפליקציה מוצגת. */
  init(): Promise<void>;
  getSnapshot(): Database;
  /** נקרא בכל שינוי, כולל שינוי שהגיע מלשונית או ממכשיר אחר. */
  subscribe(listener: () => void): () => void;
  upsert<T extends TableName>(table: T, row: Row<T>): Promise<void>;
  remove(table: TableName, id: ID): Promise<void>;
  /** שומר תמונה ומחזיר כתובת להצגה. */
  uploadPhoto(image: Blob): Promise<string>;
  reset(): Promise<void>;
}

export const TABLES: TableName[] = ['families', 'family_members', 'birthdays', 'activities', 'meals', 'tasks', 'daily_quotes', 'photos', 'events', 'shopping_items', 'meal_requests', 'routine_items', 'routine_checks', 'rewards', 'reward_requests', 'messages', 'star_log', 'settings'];

/** ציור ברירת מחדל להכנות שנוצרו לפני שנוספו הציורים */
const ROUTINE_ICONS: Record<string, string> = { 'תיק מוכן': '🎒', 'בגדים למחר': '👕', 'מקלחת': '🚿', 'צחצוח שיניים': '🦷' };

export const LOCAL_STORAGE_KEY = 'cohen-dashboard-db-v1';
const CHANNEL = 'cohen-dashboard-sync';

/** משלים שדות וטבלאות שנוספו אחרי שהנתונים נשמרו, כדי שגרסה חדשה תעבוד על נתונים ישנים. */
export function normalize(db: Partial<Database>, seedMissingTables = true): Database {
  const seed = createSeed();
  // טבלה שחסרה בנתונים ישנים: במצב מקומי מקבלת את נתוני הפתיחה, בענן נשארת ריקה
  const empty = Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Database;
  const full = { ...(seedMissingTables ? seed : empty), ...db } as Database;
  return {
    ...full,
    // שדות שנוספו בגרסאות מאוחרות מקבלים ברירת מחדל בנתונים ישנים
    family_members: full.family_members.map((m) => ({ ...m, hasDevice: m.hasDevice ?? false, stars: m.stars ?? 0 })),
    activities: full.activities.map((a) => ({ ...a, bring: a.bring ?? '' })),
    tasks: full.tasks.map((t) => ({ ...t, stars: t.stars ?? 1 })),
    routine_items: full.routine_items.map((r) => ({ ...r, icon: r.icon ?? ROUTINE_ICONS[r.text] ?? '✅', period: r.period ?? 'evening' })),
    settings: full.settings.map((s) => {
      const merged = { ...seed.settings[0], ...s, calendar: { ...seed.settings[0].calendar, ...s.calendar } };
      const kept = merged.widgets.filter((w) => WIDGETS.includes(w.key));
      const known = new Set(kept.map((w) => w.key));
      // כרטיסים שנוספו בגרסה חדשה מצטרפים כמוצגים; כרטיסים שהוסרו מהמערכת נעלמים מהרשימה
      return { ...merged, widgets: [...kept, ...WIDGETS.filter((key) => !known.has(key)).map((key) => ({ key, visible: true }))] };
    }),
  };
}

export function readLocalDatabase(): Database | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw) as Partial<Database>) : null;
  } catch {
    return null;
  }
}

/** אחסון מקומי בדפדפן, עם סנכרון מיידי בין לשוניות באותו מכשיר. */
export class LocalStore implements DataStore {
  readonly mode = 'local';
  private db: Database;
  private listeners = new Set<() => void>();
  private channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);

  constructor() {
    const stored = readLocalDatabase();
    this.db = stored ?? createSeed();
    if (!stored) this.write(this.db);
    this.channel?.addEventListener('message', () => this.reload());
    window.addEventListener('storage', (e) => e.key === LOCAL_STORAGE_KEY && this.reload());
  }

  async init(): Promise<void> {}

  getSnapshot = (): Database => this.db;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async upsert<T extends TableName>(table: T, row: Row<T>): Promise<void> {
    const rows = this.db[table] as Row<T>[];
    const exists = rows.some((r) => r.id === row.id);
    this.commit({ ...this.db, [table]: exists ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row] });
  }

  async remove(table: TableName, id: ID): Promise<void> {
    this.commit({ ...this.db, [table]: (this.db[table] as { id: ID }[]).filter((r) => r.id !== id) });
  }

  uploadPhoto(image: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(image);
    });
  }

  async reset(): Promise<void> {
    this.commit(createSeed());
  }

  private commit(next: Database): void {
    this.write(next);
    this.db = next;
    this.channel?.postMessage('changed');
    this.emit();
  }

  private reload(): void {
    const next = readLocalDatabase();
    if (!next) return;
    this.db = next;
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  /** זורק שגיאה כשהאחסון המקומי מלא (קורה בעיקר עם תמונות), כדי שהמסך יוכל להודיע על כך. */
  private write(db: Database): void {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(db));
  }
}

/** כשמוגדרים משתני הסביבה של Supabase עובדים מול הענן; אחרת מקומית. */
export const store: DataStore = cloudConfig ? new SupabaseStore(cloudConfig) : new LocalStore();
