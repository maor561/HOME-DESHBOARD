import { FAMILY_ID } from '../data/seed';
import { addDays, toISODate } from '../lib/dates';
import type { Database, ID, ISODate, MealKind, Settings, Task } from '../types';
import { store } from './store';

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

export function toggleTask(task: Task): Promise<void> {
  const done = !task.done;
  return store.upsert('tasks', { ...task, done, completedAt: done ? new Date().toISOString() : null });
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
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!response.ok) return null;
  const data = (await response.json()) as { results?: { name: string; latitude: number; longitude: number }[] };
  return data.results?.[0] ?? null;
}
