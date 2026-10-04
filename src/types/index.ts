/** מודל הנתונים. שמות הטבלאות והשדות תואמים את סכמת ה-PostgreSQL המתוכננת ב-Supabase. */

export type ID = string;
/** תאריך בפורמט YYYY-MM-DD */
export type ISODate = string;
/** שעה בפורמט HH:MM */
export type Time = string;

export interface Family {
  id: ID;
  name: string;
}

export interface FamilyMember {
  id: ID;
  familyId: ID;
  name: string;
  birthDate: ISODate | null;
  color: string;
  icon: string | null;
  /** האם מכינים לו/לה כריך לבית הספר */
  getsSandwich: boolean;
  sortOrder: number;
  /** יש לו/לה טלפון או טאבלט שאפשר לחבר ל"מסך הילד" */
  hasDevice: boolean;
  /** כוכבים שנצברו על משימות שבוצעו */
  stars: number;
}

/** ימי הולדת של אנשים שאינם בני המשפחה (סבא, סבתא, חברים). בני המשפחה נכנסים אוטומטית. */
export interface Birthday {
  id: ID;
  familyId: ID;
  name: string;
  birthDate: ISODate;
  /** כשהשנה לא ידועה לא מציגים גיל */
  yearKnown: boolean;
  icon: string;
  color: string;
}

export interface Activity {
  id: ID;
  familyId: ID;
  memberId: ID;
  title: string;
  /** 0 = ראשון ... 6 = שבת */
  weekday: number;
  startTime: Time;
  endTime: Time;
  place: string;
  icon: string;
  /** מה להביא לחוג; מוצג במסך הבוקר ובמסך הילד */
  bring: string;
}

export type MealKind = 'sandwich' | 'lunch' | 'dinner' | 'note';

/** שורה בתפריט השבועי. כריך שייך לילד (memberId), צהריים/ערב/הערה שייכים לכל המשפחה. */
export interface Meal {
  id: ID;
  familyId: ID;
  date: ISODate;
  kind: MealKind;
  memberId: ID | null;
  text: string;
}

export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Task {
  id: ID;
  familyId: ID;
  title: string;
  done: boolean;
  completedAt: string | null;
  dueDate: ISODate | null;
  priority: 'normal' | 'high';
  memberId: ID | null;
  repeat: TaskRepeat;
  /** כמה כוכבים המשימה שווה לילד שמבצע אותה */
  stars: number;
}

export interface DailyQuote {
  id: ID;
  familyId: ID;
  text: string;
  active: boolean;
  /** משפט שנקבע ידנית לתאריך מסוים גובר על הבחירה האוטומטית */
  date: ISODate | null;
}

export interface ShoppingItem {
  id: ID;
  familyId: ID;
  text: string;
  done: boolean;
  doneAt: string | null;
  /** בן המשפחה שהוסיף את הפריט, אם ידוע */
  addedBy: ID | null;
  createdAt: string;
}

/** בקשה של ילד לכריך אחר ביום מסוים. הורה מאשר או דוחה בתפריט השבועי. */
export interface MealRequest {
  id: ID;
  familyId: ID;
  memberId: ID;
  date: ISODate;
  text: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
}

export interface Photo {
  id: ID;
  familyId: ID;
  url: string;
  createdAt: string;
}

export type EventKind = 'family' | 'vacation' | 'fun';

/** אירוע בלוח השנה שהמשפחה הוסיפה. חגים וימים מיוחדים נכנסים אוטומטית ואינם נשמרים כאן. */
export interface CalendarEvent {
  id: ID;
  familyId: ID;
  title: string;
  kind: EventKind;
  date: ISODate;
  /** לאירוע של כמה ימים, למשל חופשה */
  endDate: ISODate | null;
  time: Time | null;
  memberId: ID | null;
  icon: string;
  /** חוזר כל שנה באותו תאריך */
  yearly: boolean;
}

export type DashboardStyle = 'glass' | 'board';

export type WidgetKey =
  | 'weather'
  | 'sun'
  | 'sandwiches'
  | 'meals'
  | 'activities'
  | 'tasks'
  | 'birthdays'
  | 'calendar'
  | 'photos'
  | 'quote';

export interface Settings {
  id: ID;
  familyId: ID;
  style: DashboardStyle;
  /** גופן הפתקים בסגנון "לוח המקרר": כתב יד או דפוס */
  boardFont: 'hand' | 'print';
  city: string;
  latitude: number;
  longitude: number;
  units: 'c' | 'f';
  textScale: number;
  nightDim: { enabled: boolean; from: Time; to: Time };
  widgets: { key: WidgetKey; visible: boolean }[];
  /** מה נכנס ללוח השנה אוטומטית, ואילו אירועים אוטומטיים הוסתרו (לפי מפתח האירוע) */
  calendar: { holidays: boolean; funDays: boolean; shabbat: boolean; hidden: string[] };
  /** מסך היציאה מהבית: באילו ימים, ממתי, ומתי יוצאים */
  morning: { enabled: boolean; from: Time; leave: Time; days: number[] };
  photoIntervalSec: number;
  photoShuffle: boolean;
  /** קוד הכניסה ל-Admin. בשלב המקומי נשמר כטקסט; בענן יוחלף ב-Supabase Auth. */
  pin: string;
}

export interface Database {
  families: Family[];
  family_members: FamilyMember[];
  birthdays: Birthday[];
  activities: Activity[];
  meals: Meal[];
  tasks: Task[];
  daily_quotes: DailyQuote[];
  photos: Photo[];
  events: CalendarEvent[];
  shopping_items: ShoppingItem[];
  meal_requests: MealRequest[];
  settings: Settings[];
}

export type TableName = keyof Database;
export type Row<T extends TableName> = Database[T][number];

export type WeatherKind = 'clear' | 'clouds' | 'rain' | 'fog' | 'snow';

export interface Weather {
  kind: WeatherKind;
  text: string;
  temp: number;
  feels: number;
  humidity: number;
  windKmh: number;
  /** דקות מחצות */
  sunrise: number;
  sunset: number;
  /** תחזית יומית, כולל היום */
  forecast: { date: ISODate; kind: WeatherKind; max: number }[];
  /** false כשהנתונים הם ברירת מחדל כי השירות לא זמין */
  live: boolean;
}
