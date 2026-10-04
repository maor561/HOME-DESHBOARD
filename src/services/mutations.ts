import { FAMILY_ID } from '../data/seed';
import { addDays, toISODate } from '../lib/dates';
import type { Database, FamilyMember, ID, ISODate, MealKind, MealRequest, Settings, ShoppingItem, Task } from '../types';
import { store } from './store';
import type { SupabaseStore } from './supabaseStore';

/** מזהה ייחודי. לא משתמשים ב-crypto.randomUUID כי הוא לא זמין בגלישה מהטלפון ב-http ברשת הביתית. */
export const uid = (): ID => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const mealId = (date: ISODate, kind: MealKind, memberId: ID | null): ID => [date, kind, memberId].filter(Boolean).join('-');

/** שמירת שורה בתפריט השבועי. טקסט ריק מוחק את השורה. */
export function setMeal(date: ISODate, kind: MealKind, memberId: ID | null, text: string): Promise<void> {
  const id = mealId(date, kind, memberId);
  return text.trim() === ''
    ? store.remove('meals', id)
    : store.upsert('meals', { id, familyId: FAMILY_ID, date, kind, memberId, text });
}

/** העתקת תפריט מיום ליום. kinds מגביל את ההעתקה, למשל לכריכים בלבד. */
export async function copyMeals(db: Database, from: ISODate, to: ISODate, kinds?: MealKind[]): Promise<number> {
  const source = db.meals.filter((m) => m.date === from && (!kinds || kinds.includes(m.kind)));
  for (const meal of source) await setMeal(to, meal.kind, meal.memberId, meal.text);
  return source.length;
}

export async function copyWeek(db: Database, fromWeekStart: Date, toWeekStart: Date): Promise<number> {
  let copied = 0;
  for (let day = 0; day < 7; day++) {
    copied += await copyMeals(db, toISODate(addDays(fromWeekStart, day)), toISODate(addDays(toWeekStart, day)));
  }
  return copied;
}

export const updateSettings = (settings: Settings, patch: Partial<Settings>): Promise<void> => store.upsert('settings', { ...settings, ...patch });

/** סימון משימה. כשהמשימה משויכת לבן משפחה, הכוכבים שלה מתווספים לו או יורדים ממנו. */
export async function toggleTask(task: Task): Promise<void> {
  const done = !task.done;
  await store.upsert('tasks', { ...task, done, completedAt: done ? new Date().toISOString() : null });
  const member = store.getSnapshot().family_members.find((m) => m.id === task.memberId);
  if (member && task.stars) await store.upsert('family_members', { ...member, stars: Math.max(0, member.stars + (done ? task.stars : -task.stars)) });
}

/* ---------- רשימת קניות ---------- */

export function addShoppingItem(text: string, addedBy: ID | null = null): Promise<void> {
  const item: ShoppingItem = { id: uid(), familyId: FAMILY_ID, text: text.trim(), done: false, doneAt: null, addedBy, createdAt: new Date().toISOString() };
  return store.upsert('shopping_items', item);
}

export const toggleShoppingItem = (item: ShoppingItem): Promise<void> =>
  store.upsert('shopping_items', { ...item, done: !item.done, doneAt: item.done ? null : new Date().toISOString() });

export async function clearBoughtItems(db: Database): Promise<void> {
  for (const item of db.shopping_items.filter((i) => i.done)) await store.remove('shopping_items', item.id);
}

/** הפריטים שנוספו לרשימה הכי הרבה פעמים, להוספה מהירה. נשמרים בדפדפן של מי שמנהל את הרשימה. */
const FREQUENT_KEY = 'cohen-dashboard-frequent-items';
export function frequentItems(limit = 6): string[] {
  try {
    const counts = JSON.parse(localStorage.getItem(FREQUENT_KEY) ?? '{}') as Record<string, number>;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([text]) => text);
  } catch {
    return [];
  }
}
export function rememberItem(text: string): void {
  try {
    const counts = JSON.parse(localStorage.getItem(FREQUENT_KEY) ?? '{}') as Record<string, number>;
    counts[text] = (counts[text] ?? 0) + 1;
    localStorage.setItem(FREQUENT_KEY, JSON.stringify(counts));
  } catch {
    // לא קריטי
  }
}

/* ---------- תפריט חכם ---------- */

/** טקסטים שכבר הוזנו בתפריט, מהנפוץ לנדיר. לכריכים: קודם של אותו ילד, ואחריהם של שאר הילדים. */
export function menuHistory(db: Database, kind: MealKind, memberId: ID | null = null): string[] {
  const count = (rows: typeof db.meals) => {
    const counts = new Map<string, number>();
    rows.forEach((m) => m.text.trim() && counts.set(m.text.trim(), (counts.get(m.text.trim()) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([text]) => text);
  };
  const ofKind = db.meals.filter((m) => m.kind === kind);
  const own = count(ofKind.filter((m) => m.memberId === memberId));
  return [...new Set([...own, ...count(ofKind)])];
}

/**
 * ממלא את השדות הריקים בשבוע מתוך מה שכבר הוזן בעבר, בלי לחזור על אותה מנה באותו שבוע
 * כל עוד יש במאגר מספיק מנות. מחזיר כמה שדות מולאו.
 */
export async function suggestWeek(db: Database, weekStart: Date, kids: FamilyMember[]): Promise<number> {
  let filled = 0;
  const dates = Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)));
  const slots: [MealKind, ID | null][] = [...kids.map((k): [MealKind, ID | null] => ['sandwich', k.id]), ['lunch', null], ['dinner', null]];
  for (const [kind, memberId] of slots) {
    const pool = menuHistory(db, kind, memberId);
    if (!pool.length) continue;
    const used = new Set(db.meals.filter((m) => dates.includes(m.date) && m.kind === kind && m.memberId === memberId).map((m) => m.text.trim()));
    for (const date of dates) {
      if (db.meals.some((m) => m.date === date && m.kind === kind && m.memberId === memberId && m.text.trim())) continue;
      const pick = pool.find((text) => !used.has(text)) ?? pool[(filled + dates.indexOf(date)) % pool.length];
      used.add(pick);
      await setMeal(date, kind, memberId, pick);
      filled++;
    }
  }
  return filled;
}

/* ---------- בקשות כריך ---------- */

export async function answerMealRequest(request: MealRequest, approve: boolean): Promise<void> {
  if (approve) await setMeal(request.date, 'sandwich', request.memberId, request.text);
  await store.upsert('meal_requests', { ...request, status: approve ? 'approved' : 'declined' });
}

/* ---------- פעולות מ"מסך הילד" ----------
 * בענן הילד מחובר כמכשיר בלי הרשאת כתיבה, ולכן הפעולות עוברות דרך פונקציות במסד הנתונים
 * שבודקות שהוא נוגע רק בשלו. במצב מקומי כותבים ישירות.
 */
const cloud = () => (store.mode === 'cloud' ? (store as SupabaseStore) : null);

/**
 * מריץ פעולת ילד. direct היא הכתיבה הרגילה, שמשמשת במצב מקומי וגם כשהורה מחובר
 * צופה במסך של ילד: הורה אינו "מכשיר ילד", אבל יש לו הרשאת כתיבה משלו.
 */
async function kidAction(name: string, args: Record<string, unknown>, direct: () => Promise<void>): Promise<void> {
  const store_ = cloud();
  if (!store_) return direct();
  const { error } = await store_.client.rpc(name, args);
  if (!error) return store_.reload();
  if (/not a kid device/i.test(error.message)) return direct();
  throw new Error(error.message);
}

export function kidToggleTask(task: Task): Promise<void> {
  return kidAction('kid_toggle_task', { p_task: task.id }, () => toggleTask(task));
}

export function kidAddShopping(text: string, memberId: ID): Promise<void> {
  return kidAction('kid_add_shopping', { p_id: uid(), p_text: text.trim() }, () => addShoppingItem(text, memberId));
}

export function kidRequestSandwich(memberId: ID, date: ISODate, text: string): Promise<void> {
  const id = `${date}-${memberId}`;
  return kidAction('kid_request_sandwich', { p_id: id, p_date: date, p_text: text.trim() }, () =>
    store.upsert('meal_requests', { id, familyId: FAMILY_ID, memberId, date, text: text.trim(), status: 'pending', createdAt: new Date().toISOString() }),
  );
}

const STEP: Record<Exclude<Task['repeat'], 'none'>, (d: Date) => Date> = {
  daily: (d) => addDays(d, 1),
  weekly: (d) => addDays(d, 7),
  monthly: (d) => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()),
};

/** משימות חוזרות שסומנו ביום קודם נפתחות מחדש עם תאריך היעד הבא. */
export async function rolloverTasks(db: Database, now = new Date()): Promise<void> {
  const today = toISODate(now);
  for (const task of db.tasks) {
    if (task.repeat === 'none' || !task.done || !task.completedAt) continue;
    if (toISODate(new Date(task.completedAt)) >= today) continue;
    const [y, m, d] = (task.dueDate ?? today).split('-').map(Number);
    let due = new Date(y, m - 1, d);
    do due = STEP[task.repeat](due);
    while (toISODate(due) < today);
    await store.upsert('tasks', { ...task, done: false, completedAt: null, dueDate: toISODate(due) });
  }
}

/** הקטנת תמונה מהטלפון לפני שמירה, כדי שתתאים למסך ולא תמלא את האחסון. */
export function resizeImage(file: File, maxSide = 1600, quality = 0.78): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('עיבוד התמונה נכשל'))), 'image/jpeg', quality);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('לא ניתן לקרוא את התמונה'));
    };
    image.src = url;
  });
}

export async function addPhotos(files: File[]): Promise<number> {
  let added = 0;
  for (const file of files) {
    // במצב מקומי המקום מוגבל, ולכן שומרים תמונה קטנה יותר
    const image = store.mode === 'local' ? await resizeImage(file, 1280, 0.72) : await resizeImage(file);
    const url = await store.uploadPhoto(image);
    await store.upsert('photos', { id: uid(), familyId: FAMILY_ID, url, createdAt: new Date().toISOString() });
    added++;
  }
  return added;
}

/** חיפוש קואורדינטות לעיר, דרך שירות הגאוקודינג החינמי של Open-Meteo. */
export async function geocodeCity(city: string): Promise<{ name: string; latitude: number; longitude: number } | null> {
  const params = new URLSearchParams({ name: city, count: '1', language: 'he' });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return null;
  const data = (await response.json()) as { results?: { name: string; latitude: number; longitude: number }[] };
  return data.results?.[0] ?? null;
}
