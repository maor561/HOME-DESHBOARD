import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, ID, Row, TableName } from '../types';
import type { DataStore } from './store';

export interface CloudConfig {
  url: string;
  anonKey: string;
}

// שמות המשתנים: ידני (VITE_) או כפי שהחיבור של Supabase דרך Vercel מגדיר אותם (NEXT_PUBLIC_)
const env = import.meta.env as Record<string, string | undefined>;
const url = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfig: CloudConfig | null = url && anonKey ? { url, anonKey } : null;

const TABLES: TableName[] = ['families', 'family_members', 'birthdays', 'activities', 'meals', 'tasks', 'daily_quotes', 'photos', 'events', 'settings'];
const CACHE_KEY = 'cohen-dashboard-cloud-cache-v1';
const PHOTO_BUCKET = 'photos';
const REFRESH_MS = 5 * 60_000;

const EMPTY: Database = { families: [], family_members: [], birthdays: [], activities: [], meals: [], tasks: [], daily_quotes: [], photos: [], events: [], settings: [] };

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

    this.client
      .channel('cohen-db')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const table = payload.table as TableName;
        if (!TABLES.includes(table)) return;
        if (payload.eventType === 'DELETE') this.apply(table, null, (payload.old as { id: ID }).id);
        else this.apply(table, fromRow(table, payload.new as Json));
      })
      .subscribe();

    // רשת ביטחון למקרה שהחיבור החי נפל: רענון מלא מדי כמה דקות וכשחוזרים ללשונית
    window.setInterval(() => void this.reload().catch(() => {}), REFRESH_MS);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void this.reload().catch(() => {}));
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

  private async reload(): Promise<void> {
    const results = await Promise.all(TABLES.map((table) => this.client.from(table).select('*')));
    const next = { ...EMPTY } as Record<TableName, unknown[]>;
    results.forEach(({ data, error }, i) => {
      if (error) throw new Error(`${TABLES[i]}: ${error.message}`);
      next[TABLES[i]] = (data as Json[]).map((row) => fromRow(TABLES[i], row));
    });
    this.commit(next as unknown as Database);
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
