import { useEffect } from 'react';
import { useDatabase } from './hooks/useDatabase';
import { useNow } from './hooks/useNow';
import { useRoute } from './hooks/useRoute';
import { toISODate } from './lib/dates';
import { AdminPage } from './pages/AdminPage';
import { DashboardPage } from './pages/DashboardPage';
import { rolloverTasks } from './services/mutations';
import { store } from './services/store';

export function App() {
  const path = useRoute();
  const today = toISODate(useNow());
  const db = useDatabase();

  // בכל יום חדש: משימות חוזרות שבוצעו נפתחות מחדש
  useEffect(() => {
    // במסך הבית בענן אין הרשאת כתיבה; שם הפתיחה מחדש תקרה בכניסה הבאה ל-Admin
    rolloverTasks(store.getSnapshot()).catch(() => {});
  }, [today]);

  if (path.startsWith('/admin')) return <AdminPage />;
  // ענן שעוד לא הועלו אליו נתונים: מפנים למסך הניהול
  if (!db.settings.length) {
    return (
      <main className="grid h-dvh place-items-center bg-[#05060c] p-8 text-center text-white">
        <div>
          <h1 className="font-serif text-4xl font-bold">עוד אין נתונים בענן</h1>
          <p className="mt-3 text-lg opacity-75">היכנסו למסך הניהול (‎/admin) והעלו את הנתונים.</p>
        </div>
      </main>
    );
  }
  return <DashboardPage />;
}
