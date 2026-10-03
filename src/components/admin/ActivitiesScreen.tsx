import { Copy, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { FAMILY_ID } from '../../data/seed';
import { WEEKDAYS } from '../../lib/dates';
import { uid } from '../../services/mutations';
import { store } from '../../services/store';
import type { Activity } from '../../types';
import { Avatar, Fab, IconButton, ListRow, Panel, Picker, ScreenHeader, Sheet, SheetActions, SheetLabel, TextInput, toast } from '../ui';
import { ACTIVITY_ICONS, useFamily } from './shared';

type Draft = Omit<Activity, 'weekday'> & { weekdays: number[]; isNew: boolean };

const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

/** חוגים קבועים לפי יום בשבוע. בחוג חדש אפשר לבחור כמה ימים בבת אחת. */
export function ActivitiesScreen() {
  const { db, members, memberById } = useFamily();
  const [draft, setDraft] = useState<Draft | null>(null);

  const open = (activity?: Activity) =>
    setDraft(
      activity
        ? { ...activity, weekdays: [activity.weekday], isNew: false }
        : { id: uid(), familyId: FAMILY_ID, memberId: members.find((m) => m.getsSandwich)?.id ?? members[0].id, title: '', weekdays: [new Date().getDay()], startTime: '16:00', endTime: '17:00', place: '', icon: ACTIVITY_ICONS[0], isNew: true },
    );

  const save = async () => {
    if (!draft) return;
    const { weekdays, isNew: _isNew, ...base } = draft;
    await Promise.all(weekdays.map((weekday, i) => store.upsert('activities', { ...base, id: i === 0 ? base.id : uid(), weekday })));
    setDraft(null);
    toast('החוג נשמר');
  };
  const duplicate = async (activity: Activity) => {
    await store.upsert('activities', { ...activity, id: uid(), weekday: (activity.weekday + 1) % 7 });
    toast(`שוכפל ליום ${WEEKDAYS[(activity.weekday + 1) % 7]}`);
  };
  const remove = async () => {
    if (!draft) return;
    await store.remove('activities', draft.id);
    setDraft(null);
    toast('החוג נמחק');
  };

  const byDay = WEEKDAYS.map((name, weekday) => ({
    name,
    list: db.activities.filter((a) => a.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  })).filter((day) => day.list.length);

  return (
    <>
      <ScreenHeader title="חוגים" subtitle="חוזרים כל שבוע · המסך מציג רק את של היום" />
      {!byDay.length && <p className="py-10 text-center text-soft">עוד אין חוגים. לחצו על + כדי להוסיף.</p>}
      {byDay.map((day) => (
        <Panel key={day.name} title={`יום ${day.name}`}>
          {day.list.map((a) => {
            const member = memberById.get(a.memberId);
            return (
              <ListRow key={a.id} lead={<Avatar color={member?.color}>{a.icon}</Avatar>} title={`${member?.name ?? ''} · ${a.title}`} subtitle={`${a.startTime}–${a.endTime}${a.place ? ` · ${a.place}` : ''}`}>
                <IconButton label="שכפול ליום הבא" onClick={() => duplicate(a)}><Copy className="size-5" /></IconButton>
                <IconButton label="עריכה" onClick={() => open(a)}><Pencil className="size-5" /></IconButton>
              </ListRow>
            );
          })}
        </Panel>
      ))}
      <Fab label="חוג חדש" onClick={() => open()}><Plus className="size-7" /></Fab>

      {draft && (
        <Sheet title={draft.isNew ? 'חוג חדש' : 'עריכת חוג'} onClose={() => setDraft(null)}>
          <Picker label="מי" value={draft.memberId} options={members.map((m) => [m.id, m.name])} onChange={(memberId) => setDraft({ ...draft, memberId })} />
          <SheetLabel>שם החוג</SheetLabel>
          <TextInput value={draft.title} placeholder="למשל: התעמלות קרקע" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Picker
            label={draft.isNew ? 'ימים בשבוע' : 'יום בשבוע'}
            value={draft.weekdays}
            options={DAY_LETTERS.map((letter, i) => [i, letter])}
            onChange={(day) =>
              setDraft({ ...draft, weekdays: !draft.isNew ? [day] : draft.weekdays.includes(day) ? draft.weekdays.filter((d) => d !== day) : [...draft.weekdays, day] })
            }
          />
          <div className="grid grid-cols-2 gap-2.5">
            <div><SheetLabel>התחלה</SheetLabel><TextInput type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} /></div>
            <div><SheetLabel>סיום</SheetLabel><TextInput type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} /></div>
          </div>
          <SheetLabel>מקום</SheetLabel>
          <TextInput value={draft.place} placeholder="למשל: מרכז הספורט" onChange={(e) => setDraft({ ...draft, place: e.target.value })} />
          <Picker label="אייקון" value={draft.icon} options={ACTIVITY_ICONS.map((icon) => [icon, icon])} onChange={(icon) => setDraft({ ...draft, icon })} />
          <SheetActions onCancel={() => setDraft(null)} onSave={save} disabled={!draft.title.trim() || !draft.weekdays.length} onDelete={draft.isNew ? undefined : remove} />
        </Sheet>
      )}
    </>
  );
}
