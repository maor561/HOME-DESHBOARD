import { useMemo } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { addDays } from '../../lib/dates';
import type { Database, FamilyMember, Settings } from '../../types';

export type Screen = 'home' | 'menu' | 'acts' | 'tasks' | 'more' | 'shop' | 'cal' | 'family' | 'bdays' | 'quotes' | 'photos' | 'settings';

export interface ScreenProps {
  go: (screen: Screen) => void;
}

export interface FamilyData {
  db: Database;
  settings: Settings;
  members: FamilyMember[];
  kids: FamilyMember[];
  memberById: Map<string, FamilyMember>;
}

export function useFamily(): FamilyData {
  const db = useDatabase();
  return useMemo(() => {
    const members = [...db.family_members].sort((a, b) => a.sortOrder - b.sortOrder);
    return { db, settings: db.settings[0], members, kids: members.filter((m) => m.getsSandwich), memberById: new Map(members.map((m) => [m.id, m])) };
  }, [db]);
}

/** יום ראשון של השבוע שבו נמצא התאריך, בהזזה של מספר שבועות. */
export function weekStart(date: Date, weekOffset = 0): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(start, -start.getDay() + weekOffset * 7);
}

export const MEMBER_COLORS = ['#2f9e7a', '#0f9aa8', '#e2607a', '#8a63d2', '#3f8fdc', '#e08a1a', '#c98a3a', '#7a8aa0'];
export const ACTIVITY_ICONS = ['🤸', '⚽', '🎨', '🎹', '🥋', '🏊', '💃', '🎸', '♟️', '🏀', '🎭', '📚'];
