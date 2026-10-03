import { useSyncExternalStore } from 'react';
import { store } from '../services/store';
import type { Database } from '../types';

/** מצב הנתונים העדכני. הרכיב מתרענן אוטומטית בכל שינוי, גם כזה שנעשה ב-Admin. */
export function useDatabase(): Database {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
