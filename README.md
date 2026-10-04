# משפחת כהן · Dashboard משפחתי

מסך קבוע לבית (`/dashboard`) ומערכת ניהול לטלפון (`/admin`).

## הפעלה

```bash
npm install
npm run dev
```

- המסך: http://localhost:5180/dashboard
- המסך של הילד: http://localhost:5180/kid (במצב מקומי בוחרים ילד; אפשר גם `/kid?member=alma`)
- הניהול: http://localhost:5180/admin (קוד פתיחה: `1234`, מחליפים בהגדרות)
- מצב בוקר ויום הולדת לבדיקה: `?time=07:17&mode=morning`, `?date=2026-10-29`
- בדיקת מצבים במסך: `?time=18:10&weather=rain` (ערכי weather: `clear`, `clouds`, `rain`, `fog`, `snow`)

`npm run build` בונה גרסת הפצה ל-`dist/`, ו-`npm run typecheck` בודק טיפוסים.

## מבנה

```
src/
  types/        מודל הנתונים (תואם לטבלאות ה-PostgreSQL)
  data/         נתוני פתיחה
  lib/          תאריכים, ימי הולדת, משפט היום, צבעי השמיים
  services/     store (שכבת הנתונים), weather (Open-Meteo), mutations (פעולות כתיבה)
  hooks/        useDatabase, useDashboard, useWeather, useNow, useRoute
  components/
    dashboard/  רכיבי המסך: שמיים, שעון, מזג אוויר, רשימות, תמונות
    admin/      מסכי הניהול
    ui/         ערכת רכיבים ל-Admin
  layouts/      שני סגנונות המסך: GlassLayout, BoardLayout
  pages/        DashboardPage, AdminPage
  styles/       dashboard.css (המסך), index.css (Tailwind ל-Admin)
docs/
  mockups/             הסקיצות שאושרו
  supabase-schema.sql  טיוטת הסכמה לענן
```

## נתונים

כל המסכים עובדים מול הממשק `DataStore` (`src/services/store.ts`), שיש לו שני מימושים:

- **`LocalStore`** (ברירת המחדל): שומר ב-localStorage של הדפדפן. כל מכשיר רואה רק את הנתונים שלו.
- **`SupabaseStore`**: נכנס לפעולה כשמוגדרים `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY`. נתונים ב-PostgreSQL,
  עדכון מיידי בין מכשירים ב-Realtime, תמונות ב-Storage, והתחברות במייל וסיסמה במקום ה-PIN.
  **נכתב ועבר בדיקת טיפוסים, אבל עוד לא הורץ מול פרויקט Supabase אמיתי.**

## חיבור Supabase

1. לפתוח פרויקט ב-supabase.com.
2. ב-SQL Editor להריץ את `docs/supabase-schema.sql`.
3. (הסקריפט יוצר גם את אחסון התמונות `photos` ואת ההרשאות שלו.)
4. ב-Authentication > Users ליצור משתמש אחד (מייל וסיסמה) לניהול.
5. להעתיק את `.env.example` ל-`.env.local` ולמלא את שני הערכים מתוך Project Settings > API.
6. להפעיל מחדש את `npm run dev`, להיכנס ל-`/admin`, להתחבר, וללחוץ "העלאת הנתונים מהמכשיר הזה".

## סקריפטים למסד הנתונים

מריצים לפי הסדר ב-SQL Editor של Supabase, כל אחד פעם אחת:

1. `docs/supabase-schema.sql`: הטבלאות, אחסון התמונות, Realtime.
2. `docs/supabase-002-viewer-access.sql`: מנהלים ומסכים מאושרים (חיבור ב-QR).
3. `docs/supabase-003-features.sql`: רשימת קניות, מצב בוקר, מסך הילד, כוכבים ובקשות כריך.

## הרשאות וחיבור מסכים

אחרי הרצת `docs/supabase-002-viewer-access.sql` (והפעלת Anonymous sign-ins ב-Supabase):

- **עריכה** רק למשתמשים שבטבלת `admins`.
- **צפייה** רק למנהלים ולמסכים שבטבלת `devices`.
- **חיבור מסך:** `/dashboard` במסך שלא חובר מציג קוד QR וקוד בן 4 ספרות. סורקים בטלפון, מתחברים, מוודאים שהקוד זהה ומאשרים. המסך נפתח לבד תוך כמה שניות.
- **ניתוק מסך:** Admin > עוד > הגדרות ותצוגה > מסכים מחוברים.

עד שהסקריפט רץ, הקוד מזהה שהטבלאות חסרות ומתנהג כמו קודם (צפייה פתוחה).

## הרחבות עתידיות

- **מזג אוויר אחר:** מימוש נוסף של `WeatherProvider` ב-`src/services/weather.ts`.
- **חיישני בית / Home Assistant:** כרטיס "מצב הבית" כבר קיים בהגדרות (מוסתר); צריך ספק נתונים ורכיב תצוגה.
- **כרטיס חדש במסך:** מפתח ב-`WidgetKey`, שדה ב-`DashboardModel`, רכיב ב-`widgets.tsx`, ומיקום בשני ה-layouts.
- **טבלה חדשה:** שדה ב-`Database` ב-`types/`, ושורה בנתוני הפתיחה.
