import { addDays, toISODate } from '../lib/dates';
import type { Database, Meal, WidgetKey } from '../types';

export const FAMILY_ID = 'cohen';

export const WIDGETS: WidgetKey[] = ['weather', 'sun', 'calendar', 'sandwiches', 'meals', 'activities', 'tasks', 'birthdays', 'photos', 'quote', 'home'];

/**
 * נתוני פתיחה. בני המשפחה והתאריכים אמיתיים; התפריט, החוגים, המשימות,
 * האנשים הנוספים והתמונות הם דוגמאות שמחליפים ב-Admin.
 */
export function createSeed(today = new Date()): Database {
  const kids = ['alma', 'gaya', 'eylon', 'neri'];
  const sandwiches = [
    ['פיתה עם חומוס ומלפפון', 'לחמנייה עם גבינה צהובה', 'טוסט גבינה לבנה וזיתים', 'פרוסה עם אבוקדו'],
    ['כריך טונה', 'פיתה עם שוקולד', 'לחמנייה עם חביתה', 'פרוסה עם גבינה'],
  ];
  const dishes = [
    ['שניצל, אורז וסלט', 'פסטה ברוטב עגבניות'],
    ['קציצות ופירה', 'שקשוקה'],
  ];

  const meals: Meal[] = [];
  [0, 1].forEach((offset) => {
    const date = toISODate(addDays(today, offset));
    kids.forEach((memberId, i) =>
      meals.push({ id: `${date}-sandwich-${memberId}`, familyId: FAMILY_ID, date, kind: 'sandwich', memberId, text: sandwiches[offset][i] }),
    );
    meals.push({ id: `${date}-lunch`, familyId: FAMILY_ID, date, kind: 'lunch', memberId: null, text: dishes[offset][0] });
    meals.push({ id: `${date}-dinner`, familyId: FAMILY_ID, date, kind: 'dinner', memberId: null, text: dishes[offset][1] });
  });

  const weekday = today.getDay();
  const activity = (id: string, memberId: string, icon: string, title: string, day: number, startTime: string, endTime: string, place: string) => ({
    id, familyId: FAMILY_ID, memberId, icon, title, weekday: day, startTime, endTime, place,
  });

  return {
    families: [{ id: FAMILY_ID, name: 'משפחת כהן' }],
    family_members: [
      { id: 'maor', familyId: FAMILY_ID, name: 'מאור', birthDate: '1984-09-15', color: '#2f9e7a', icon: null, getsSandwich: false, sortOrder: 0 },
      { id: 'nofar', familyId: FAMILY_ID, name: 'נופר', birthDate: '1991-08-14', color: '#0f9aa8', icon: null, getsSandwich: false, sortOrder: 1 },
      { id: 'alma', familyId: FAMILY_ID, name: 'אלמה', birthDate: '2015-06-01', color: '#e2607a', icon: null, getsSandwich: true, sortOrder: 2 },
      { id: 'gaya', familyId: FAMILY_ID, name: 'גאיה', birthDate: '2017-09-30', color: '#8a63d2', icon: null, getsSandwich: true, sortOrder: 3 },
      { id: 'eylon', familyId: FAMILY_ID, name: 'אילון', birthDate: '2020-09-07', color: '#3f8fdc', icon: null, getsSandwich: true, sortOrder: 4 },
      { id: 'neri', familyId: FAMILY_ID, name: 'נרי', birthDate: '2022-10-29', color: '#e08a1a', icon: null, getsSandwich: true, sortOrder: 5 },
    ],
    birthdays: [
      { id: 'demo-grandma', familyId: FAMILY_ID, name: 'סבתא', birthDate: '1955-11-12', yearKnown: true, icon: '🎂', color: '#c98a3a' },
      { id: 'demo-grandpa', familyId: FAMILY_ID, name: 'סבא', birthDate: '1952-12-03', yearKnown: true, icon: '🎂', color: '#7a8aa0' },
    ],
    activities: [
      activity('demo-act-1', 'alma', '🤸', 'התעמלות קרקע', weekday, '16:00', '17:15', 'מרכז הספורט'),
      activity('demo-act-2', 'gaya', '🎨', 'ציור', weekday, '16:30', '17:30', 'המתנ״ס'),
      activity('demo-act-3', 'eylon', '⚽', 'כדורגל', weekday, '17:00', '18:00', 'מגרש השכונה'),
      activity('demo-act-4', 'alma', '🎹', 'פסנתר', (weekday + 1) % 7, '15:30', '16:15', 'הקונסרבטוריון'),
    ],
    meals,
    tasks: [
      { id: 'demo-task-1', familyId: FAMILY_ID, title: 'לקנות חלב', done: true, completedAt: today.toISOString(), dueDate: toISODate(today), priority: 'normal', memberId: 'maor', repeat: 'none' },
      { id: 'demo-task-2', familyId: FAMILY_ID, title: 'להכין תיקים לבית הספר', done: false, completedAt: null, dueDate: toISODate(today), priority: 'high', memberId: 'alma', repeat: 'daily' },
      { id: 'demo-task-3', familyId: FAMILY_ID, title: 'לשלם חשבון חשמל', done: false, completedAt: null, dueDate: toISODate(addDays(today, 1)), priority: 'normal', memberId: 'nofar', repeat: 'none' },
      { id: 'demo-task-4', familyId: FAMILY_ID, title: 'להזמין ניקיון', done: false, completedAt: null, dueDate: toISODate(addDays(today, 3)), priority: 'normal', memberId: null, repeat: 'none' },
    ],
    daily_quotes: [
      'הדברים הגדולים מתחילים בצעדים קטנים.',
      'כל יום הוא התחלה חדשה.',
      'ביחד אנחנו יכולים הכול.',
      'טעות היא רק עוד דרך ללמוד.',
      'מילה טובה אחת יכולה לשנות יום שלם.',
    ].map((text, i) => ({ id: `quote-${i}`, familyId: FAMILY_ID, text, active: true, date: null })),
    photos: ['a', 'b', 'c', 'd'].map((seed) => ({
      id: `demo-photo-${seed}`, familyId: FAMILY_ID, url: `https://picsum.photos/seed/cohen-${seed}/1400/1000`, createdAt: today.toISOString(),
    })),
    events: [],
    settings: [
      {
        id: FAMILY_ID,
        familyId: FAMILY_ID,
        style: 'glass',
        boardFont: 'hand',
        city: 'יקנעם עילית',
        latitude: 32.659,
        longitude: 35.11,
        units: 'c',
        textScale: 1,
        nightDim: { enabled: true, from: '22:30', to: '06:00' },
        widgets: WIDGETS.map((key) => ({ key, visible: key !== 'home' })),
        calendar: { holidays: true, funDays: true, hidden: [] },
        photoIntervalSec: 30,
        photoShuffle: true,
        pin: '1234',
      },
    ],
  };
}
