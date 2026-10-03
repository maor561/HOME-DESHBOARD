import { Eye, EyeOff, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { FAMILY_ID } from '../../data/seed';
import { useHolidays } from '../../hooks/useHolidays';
import { useNow } from '../../hooks/useNow';
import { EVENT_COLOR, EVENT_LABEL, buildWeek, displayedWeekStart, type DayEvent } from '../../lib/calendar';
import { addDays, toISODate } from '../../lib/dates';
import { uid, updateSettings } from '../../services/mutations';
import { store } from '../../services/store';
import type { CalendarEvent, EventKind } from '../../types';
import { Avatar, Fab, IconButton, ListRow, Panel, Picker, ScreenHeader, Sheet, SheetActions, SheetLabel, Tag, TextInput, Toggle, toast } from '../ui';
import { useFamily, type ScreenProps } from './shared';

type Draft = CalendarEvent & { isNew: boolean };

const KIND_OPTIONS: [EventKind, string][] = [['family', 'אירוע שלנו'], ['vacation', 'חופשה'], ['fun', 'יום מיוחד']];
const ICONS = ['📌', '🎉', '🏖️', '🚌', '🎭', '🦷', '⚽', '🎓', '🍕', '🍔', '✈️', '❤️'];

/** לוח השנה: מה נכנס אוטומטית, מה מוצג השבוע, והאירועים שהמשפחה מוסיפה. */
export function CalendarScreen({ go }: ScreenProps) {
  const { db, settings, members } = useFamily();
  const now = useNow();
  const [draft, setDraft] = useState<Draft | null>(null);
  const start = displayedWeekStart(now);
  const holidays = useHolidays(toISODate(start), toISODate(addDays(start, 6)), settings.calendar.holidays);
  const week = buildWeek(now, { events: db.events, holidays, members, birthdays: db.birthdays, settings }, true);
  const hidden = new Set(settings.calendar.hidden);
  const saveCalendar = (patch: Partial<typeof settings.calendar>) => updateSettings(settings, { calendar: { ...settings.calendar, ...patch } });

  const open = (date: string, event?: CalendarEvent) =>
    setDraft(event ? { ...event, isNew: false } : { id: uid(), familyId: FAMILY_ID, title: '', kind: 'family', date, endDate: null, time: null, memberId: null, icon: ICONS[0], yearly: false, isNew: true });

  const save = async () => {
    if (!draft) return;
    const { isNew: _isNew, ...event } = draft;
    await store.upsert('events', { ...event, title: event.title.trim(), endDate: event.endDate && event.endDate > event.date ? event.endDate : null });
    setDraft(null);
    toast('האירוע נשמר');
  };
  const remove = async () => {
    if (!draft) return;
    await store.remove('events', draft.id);
    setDraft(null);
    toast('האירוע נמחק');
  };
  const toggleHidden = (event: DayEvent) =>
    saveCalendar({ hidden: hidden.has(event.key) ? settings.calendar.hidden.filter((k) => k !== event.key) : [...settings.calendar.hidden, event.key] });

  return (
    <>
      <ScreenHeader title="לוח שנה" subtitle="המסך מציג שבוע מראשון עד שבת, ובשבת ב-18:00 עובר לשבוע הבא" onBack={() => go('more')} />

      <Panel title="מה נכנס אוטומטית">
        <ListRow lead={<Avatar color={EVENT_COLOR.holiday}>🕎</Avatar>} title="חגים ומועדים" subtitle="לפי הלוח העברי">
          <Toggle label="חגים ומועדים" checked={settings.calendar.holidays} onChange={(holidays) => saveCalendar({ holidays })} />
        </ListRow>
        <ListRow lead={<Avatar color={EVENT_COLOR.fun}>🍕</Avatar>} title="ימים מיוחדים" subtitle="יום הפיצה, יום ההמבורגר ועוד">
          <Toggle label="ימים מיוחדים" checked={settings.calendar.funDays} onChange={(funDays) => saveCalendar({ funDays })} />
        </ListRow>
        <p className="py-2.5 text-sm text-soft">חופשות בית הספר מוסיפים כאירוע מסוג "חופשה" עם תאריך התחלה וסיום.</p>
      </Panel>

      <Panel title="השבוע במסך">
        {week.map((day) => (
          <div key={day.date} className="py-3 first:pt-0 last:pb-0">
            <h3 className="mb-1 flex items-center gap-2 font-serif text-[19px] font-bold">
              {day.name} <Tag tone="grey">{day.shortDate}</Tag>
              <button className="ms-auto font-sans text-sm font-bold text-accent" onClick={() => open(day.date)}>+ אירוע</button>
            </h3>
            {!day.events.length && <p className="text-[15px] text-faint">אין אירועים</p>}
            {day.events.map((event) => {
              const own = db.events.find((e) => e.id === event.key);
              const isHidden = hidden.has(event.key);
              return (
                <div key={event.key} className={`flex min-h-11 items-center gap-2.5 py-1 ${isHidden ? 'opacity-45' : ''}`}>
                  <span className="min-w-[74px] flex-none rounded-full px-2.5 py-0.5 text-center text-sm font-bold text-white" style={{ background: EVENT_COLOR[event.kind] }}>{EVENT_LABEL[event.kind]}</span>
                  <b className="min-w-0 flex-1 truncate">{event.title}</b>
                  {own ? (
                    <IconButton label="עריכה" onClick={() => open(day.date, own)}><Pencil className="size-5" /></IconButton>
                  ) : event.kind !== 'birthday' && (
                    <IconButton label={isHidden ? 'החזרה למסך' : 'הסתרה מהמסך'} onClick={() => toggleHidden(event)}>
                      {isHidden ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </IconButton>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Panel>

      <Panel title="כל האירועים שלנו">
        {!db.events.length && <p className="py-4 text-center text-soft">עוד לא הוספתם אירועים</p>}
        {[...db.events].sort((a, b) => a.date.localeCompare(b.date)).map((event) => (
          <ListRow
            key={event.id}
            lead={<Avatar color={EVENT_COLOR[event.kind]}>{event.icon}</Avatar>}
            title={event.title}
            subtitle={`${event.date.split('-').reverse().map(Number).slice(0, 2).join('.')}${event.endDate ? `–${event.endDate.split('-').reverse().map(Number).slice(0, 2).join('.')}` : ''}${event.yearly ? ' · כל שנה' : ''}`}
          >
            <IconButton label="עריכה" onClick={() => open(event.date, event)}><Pencil className="size-5" /></IconButton>
          </ListRow>
        ))}
      </Panel>
      <Fab label="אירוע חדש" onClick={() => open(toISODate(now))}><Plus className="size-7" /></Fab>

      {draft && (
        <Sheet title={draft.isNew ? 'אירוע חדש' : 'עריכת אירוע'} onClose={() => setDraft(null)}>
          <TextInput autoFocus value={draft.title} placeholder="למשל: טיול שנתי, חופשת חנוכה" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Picker label="סוג" value={draft.kind} options={KIND_OPTIONS} onChange={(kind) => setDraft({ ...draft, kind })} />
          <div className="grid grid-cols-2 gap-2.5">
            <div><SheetLabel>תאריך</SheetLabel><TextInput type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></div>
            <div><SheetLabel>עד (לא חובה)</SheetLabel><TextInput type="date" value={draft.endDate ?? ''} min={draft.date} onChange={(e) => setDraft({ ...draft, endDate: e.target.value || null })} /></div>
          </div>
          <SheetLabel>שעה (לא חובה)</SheetLabel>
          <TextInput type="time" value={draft.time ?? ''} onChange={(e) => setDraft({ ...draft, time: e.target.value || null })} />
          <Picker label="אייקון" value={draft.icon} options={ICONS.map((icon) => [icon, icon])} onChange={(icon) => setDraft({ ...draft, icon })} />
          <div className="mt-3 flex items-center gap-3">
            <span className="flex-1"><b className="block">חוזר כל שנה</b><small className="text-sm text-soft">למשל יום נישואין</small></span>
            <Toggle label="חוזר כל שנה" checked={draft.yearly} onChange={(yearly) => setDraft({ ...draft, yearly })} />
          </div>
          <SheetActions onCancel={() => setDraft(null)} onSave={save} disabled={!draft.title.trim() || !draft.date} onDelete={draft.isNew ? undefined : remove} />
        </Sheet>
      )}
    </>
  );
}
