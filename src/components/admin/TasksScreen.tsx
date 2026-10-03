import { Check, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { FAMILY_ID } from '../../data/seed';
import { addDays, dueLabel, toISODate } from '../../lib/dates';
import { toggleTask, uid } from '../../services/mutations';
import { store } from '../../services/store';
import type { Task, TaskRepeat } from '../../types';
import { Fab, IconButton, MemberChip, Picker, ScreenHeader, Segmented, Sheet, SheetActions, TextInput, toast } from '../ui';
import { useFamily } from './shared';

type Filter = 'open' | 'all' | 'repeat';
const REPEAT_LABEL: Record<TaskRepeat, string> = { none: 'חד-פעמית', daily: 'כל יום', weekly: 'כל שבוע', monthly: 'כל חודש' };

export const newTask = (): Task => ({ id: uid(), familyId: FAMILY_ID, title: '', done: false, completedAt: null, dueDate: toISODate(new Date()), priority: 'normal', memberId: null, repeat: 'none' });

export function TaskSheet({ task, isNew, onClose }: { task: Task; isNew: boolean; onClose: () => void }) {
  const { members } = useFamily();
  const [draft, setDraft] = useState(task);
  const today = toISODate(new Date());
  const tomorrow = toISODate(addDays(new Date(), 1));
  const dueKey = draft.dueDate === today ? 'today' : draft.dueDate === tomorrow ? 'tomorrow' : draft.dueDate ? 'date' : 'none';

  const save = async () => {
    await store.upsert('tasks', { ...draft, title: draft.title.trim() });
    onClose();
    toast(isNew ? 'המשימה נוספה' : 'המשימה עודכנה');
  };
  const remove = async () => {
    await store.remove('tasks', draft.id);
    onClose();
    toast('המשימה נמחקה');
  };

  return (
    <Sheet title={isNew ? 'משימה חדשה' : 'עריכת משימה'} onClose={onClose}>
      <TextInput autoFocus value={draft.title} placeholder="מה צריך לעשות?" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      <Picker label="למי" value={draft.memberId ?? ''} options={[['', 'כולם'], ...members.map((m): [string, string] => [m.id, m.name])]} onChange={(id) => setDraft({ ...draft, memberId: id || null })} />
      <Picker
        label="מתי"
        value={dueKey}
        options={[['today', 'היום'], ['tomorrow', 'מחר'], ['date', 'תאריך…'], ['none', 'בלי תאריך']]}
        onChange={(key) => setDraft({ ...draft, dueDate: key === 'today' ? today : key === 'tomorrow' ? tomorrow : key === 'none' ? null : toISODate(addDays(new Date(), 2)) })}
      />
      {dueKey === 'date' && <TextInput type="date" className="mt-2" value={draft.dueDate ?? ''} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value || null })} />}
      <Picker label="חוזרת" value={draft.repeat} options={Object.entries(REPEAT_LABEL) as [TaskRepeat, string][]} onChange={(repeat) => setDraft({ ...draft, repeat })} />
      <Picker label="עדיפות" value={draft.priority} options={[['normal', 'רגילה'], ['high', 'גבוהה']]} onChange={(priority) => setDraft({ ...draft, priority })} />
      <SheetActions onCancel={onClose} onSave={save} saveLabel={isNew ? 'הוספה' : 'שמירה'} disabled={!draft.title.trim()} onDelete={isNew ? undefined : remove} />
    </Sheet>
  );
}

export function TasksScreen() {
  const { db, memberById } = useFamily();
  const [filter, setFilter] = useState<Filter>('open');
  const [editing, setEditing] = useState<{ task: Task; isNew: boolean } | null>(null);
  const now = new Date();

  const tasks = db.tasks
    .filter((t) => (filter === 'open' ? !t.done : filter === 'repeat' ? t.repeat !== 'none' : true))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'));

  return (
    <>
      <ScreenHeader title="משימות" />
      <Segmented value={filter} options={[['open', 'פתוחות'], ['all', 'הכול'], ['repeat', 'חוזרות']]} onChange={setFilter} />
      <section className="mb-3.5 divide-y divide-line rounded-[20px] bg-card px-4 py-1.5 shadow-[0_1px_0_var(--color-line)]">
        {!tasks.length && <p className="py-8 text-center text-soft">אין משימות ברשימה הזו</p>}
        {tasks.map((task) => {
          const member = task.memberId ? memberById.get(task.memberId) : null;
          const meta = [dueLabel(task.dueDate, now), task.repeat !== 'none' && `🔁 ${REPEAT_LABEL[task.repeat]}`, task.priority === 'high' && 'עדיפות גבוהה'].filter(Boolean).join(' · ');
          return (
            <div key={task.id} className="flex min-h-14 items-center gap-3 py-2.5">
              <button role="checkbox" aria-checked={task.done} aria-label={`סימון: ${task.title}`} onClick={() => toggleTask(task)}
                className={`grid size-7 flex-none place-items-center rounded-[9px] border-2 ${task.done ? 'border-ok bg-ok text-white' : 'border-faint text-transparent'}`}>
                <Check className="size-4" strokeWidth={3} />
              </button>
              <div className="min-w-0 flex-1">
                <b className={`block truncate text-[17px] font-bold ${task.done ? 'text-faint line-through' : ''}`}>{task.title}</b>
                {meta && <small className="block truncate text-sm text-soft">{meta}</small>}
              </div>
              {member && <MemberChip member={member} />}
              <IconButton label="עריכה" onClick={() => setEditing({ task, isNew: false })}><Pencil className="size-5" /></IconButton>
            </div>
          );
        })}
      </section>
      <Fab label="משימה חדשה" onClick={() => setEditing({ task: newTask(), isNew: true })}><Plus className="size-7" /></Fab>
      {editing && <TaskSheet {...editing} onClose={() => setEditing(null)} />}
    </>
  );
}
