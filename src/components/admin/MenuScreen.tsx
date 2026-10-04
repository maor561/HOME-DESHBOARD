import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { useState } from 'react';
import { WEEKDAYS, addDays, toISODate } from '../../lib/dates';
import { answerMealRequest, copyMeals, copyWeek, menuHistory, setMeal, suggestWeek } from '../../services/mutations';
import type { ISODate, MealKind } from '../../types';
import { Button, Field, IconButton, MemberChip, Panel, ScreenHeader, Segmented, Tag, TextInput, toast } from '../ui';
import { useFamily, weekStart, type FamilyData } from './shared';

type DayStatus = 'full' | 'part' | 'empty';

function dayStatus({ db, kids }: FamilyData, date: ISODate): DayStatus {
  const meals = db.meals.filter((m) => m.date === date && m.kind !== 'note');
  if (!meals.length) return 'empty';
  return meals.length >= kids.length + 2 ? 'full' : 'part';
}

const STATUS_LABEL: Record<DayStatus, string> = { full: 'מלא', part: 'חלקי', empty: 'ריק' };
const DOT: Record<DayStatus, string> = { full: 'bg-ok', part: 'bg-[#e0a020]', empty: 'hidden' };
const shortDate = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}`;

/** התפריט השבועי: כריך לכל ילד, צהריים וערב לכל יום. נשמר תוך כדי הקלדה. */
export function MenuScreen() {
  const family = useFamily();
  const { db, kids } = family;
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<'day' | 'week'>('day');
  // נפתחים על מחר (ועל השבוע שלו), כי את הכריכים של מחר מכינים היום
  const tomorrow = addDays(new Date(), 1);
  const start = weekStart(tomorrow, weekOffset);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const [dayIndex, setDayIndex] = useState(tomorrow.getDay());
  const date = toISODate(days[dayIndex]);
  const thisWeek = toISODate(weekStart(new Date()));
  const weekLabel = toISODate(start) === thisWeek ? 'השבוע · ' : toISODate(addDays(start, -7)) === thisWeek ? 'שבוע הבא · ' : '';

  const text = (day: ISODate, kind: MealKind, memberId: string | null = null) =>
    db.meals.find((m) => m.date === day && m.kind === kind && m.memberId === memberId)?.text ?? '';

  // ההצעות מתחת לשדות מתייחסות לשדה האחרון שנגעו בו
  const [focus, setFocus] = useState<{ kind: MealKind; memberId: string | null }>({ kind: 'sandwich', memberId: kids[0]?.id ?? null });
  const focusName = focus.kind === 'sandwich' ? `ל${family.memberById.get(focus.memberId ?? '')?.name ?? ''}` : focus.kind === 'lunch' ? 'לצהריים' : 'לערב';
  const suggestions = menuHistory(db, focus.kind, focus.memberId).filter((option) => option !== text(date, focus.kind, focus.memberId).trim()).slice(0, 8);
  const requests = db.meal_requests.filter((r) => r.date === date && r.status === 'pending');
  const listId = (kind: MealKind, memberId: string | null) => `menu-${kind}-${memberId ?? 'all'}`;

  const fillWeek = async () => {
    const count = await suggestWeek(db, start, kids);
    toast(count ? `מולאו ${count} שדות ריקים מתוך המאגר` : 'אין שדות ריקים, או שעוד אין מאגר להציע ממנו');
  };
  const copyYesterday = async () => {
    const count = await copyMeals(db, toISODate(addDays(days[dayIndex], -1)), date, ['sandwich']);
    toast(count ? 'הכריכים הועתקו מאתמול' : 'אין כריכים ביום הקודם');
  };
  const copyPreviousWeek = async () => {
    const count = await copyWeek(db, addDays(start, -7), start);
    toast(count ? 'השבוע הקודם הועתק' : 'השבוע הקודם ריק');
  };

  return (
    <>
      <ScreenHeader title="תפריט שבועי" subtitle="המסך מציג כריכים של מחר ואוכל של היום" />
      <div className="mb-3 flex items-center gap-2">
        <IconButton label="השבוע הקודם" onClick={() => setWeekOffset(weekOffset - 1)}><ChevronRight className="size-5" /></IconButton>
        <b className="flex-1 text-center">{weekLabel}<span dir="ltr">{shortDate(days[0])}–{shortDate(days[6])}</span></b>
        <IconButton label="השבוע הבא" onClick={() => setWeekOffset(weekOffset + 1)}><ChevronLeft className="size-5" /></IconButton>
      </div>
      <Segmented value={view} options={[['day', 'יום'], ['week', 'כל השבוע']]} onChange={setView} />

      {view === 'day' ? (
        <>
          <div className="-mx-4 mb-3.5 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
            {days.map((d, i) => {
              const iso = toISODate(d);
              const active = i === dayIndex;
              return (
                <button key={iso} aria-pressed={active} onClick={() => setDayIndex(i)}
                  className={`relative flex h-[62px] min-w-[54px] flex-1 flex-col items-center justify-center rounded-2xl text-[15px] font-bold shadow-[0_1px_0_var(--color-line)] ${active ? 'bg-ink text-white' : 'bg-card'}`}>
                  {WEEKDAYS[d.getDay()]}
                  <small className={`text-xs font-semibold ${active ? 'text-white/70' : 'text-soft'}`}>{shortDate(d)}</small>
                  <span className={`absolute end-2 top-[7px] size-[7px] rounded-full ${DOT[dayStatus(family, iso)]}`} />
                </button>
              );
            })}
          </div>
          {requests.map((request) => (
            <div key={request.id} className="mb-3.5 rounded-2xl bg-[#fff4d6] px-3.5 py-3 text-[15px] font-semibold">
              🥪 {family.memberById.get(request.memberId)?.name} ביקש/ה: <b>{request.text}</b>
              <div className="mt-2 flex gap-2">
                <Button className="h-10 flex-1 text-sm" onClick={async () => { await answerMealRequest(request, true); toast('הכריך עודכן'); }}>אישור</Button>
                <Button variant="ghost" className="h-10 flex-1 text-sm" onClick={() => answerMealRequest(request, false)}>לא הפעם</Button>
              </div>
            </div>
          ))}
          <Panel title="כריכים לבית הספר" action={<button onClick={copyYesterday}>העתק מאתמול</button>}>
            {kids.map((kid) => (
              <label key={kid.id} className="flex items-center gap-2.5 py-1.5">
                <MemberChip member={kid} />
                <TextInput value={text(date, 'sandwich', kid.id)} placeholder="מה בכריך?" aria-label={`כריך של ${kid.name}`} list={listId('sandwich', kid.id)}
                  onFocus={() => setFocus({ kind: 'sandwich', memberId: kid.id })} onChange={(e) => setMeal(date, 'sandwich', kid.id, e.target.value)} />
                <datalist id={listId('sandwich', kid.id)}>{menuHistory(db, 'sandwich', kid.id).map((option) => <option key={option} value={option} />)}</datalist>
              </label>
            ))}
          </Panel>
          {suggestions.length > 0 && (
            <div className="-mx-4 mb-3.5 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              <span className="whitespace-nowrap text-[13px] font-bold text-soft">הצעות {focusName}:</span>
              {suggestions.map((option) => (
                <button key={option} onClick={() => setMeal(date, focus.kind, focus.memberId, option)} className="h-[34px] flex-none rounded-full bg-accent-soft px-3 text-sm font-bold text-accent">{option}</button>
              ))}
            </div>
          )}
          <Panel title="ארוחות">
            <Field label="צהריים"><TextInput value={text(date, 'lunch')} placeholder="מה אוכלים?" list={listId('lunch', null)} onFocus={() => setFocus({ kind: 'lunch', memberId: null })} onChange={(e) => setMeal(date, 'lunch', null, e.target.value)} /></Field>
            <Field label="ערב"><TextInput value={text(date, 'dinner')} placeholder="מה אוכלים?" list={listId('dinner', null)} onFocus={() => setFocus({ kind: 'dinner', memberId: null })} onChange={(e) => setMeal(date, 'dinner', null, e.target.value)} /></Field>
            <datalist id={listId('lunch', null)}>{menuHistory(db, 'lunch').map((option) => <option key={option} value={option} />)}</datalist>
            <datalist id={listId('dinner', null)}>{menuHistory(db, 'dinner').map((option) => <option key={option} value={option} />)}</datalist>
            <Field label="הערה"><TextInput value={text(date, 'note')} placeholder="למשל: להפשיר עוף בבוקר" onChange={(e) => setMeal(date, 'note', null, e.target.value)} /></Field>
          </Panel>
          <p className="text-center text-sm text-soft">נשמר אוטומטית</p>
        </>
      ) : (
        <>
          <section className="mb-3.5 divide-y divide-line rounded-[20px] bg-card p-4 shadow-[0_1px_0_var(--color-line)]">
            {days.map((d, i) => {
              const iso = toISODate(d);
              const status = dayStatus(family, iso);
              const line = (label: string, value: string, color?: string) => (
                <p key={label} className="flex gap-2 py-0.5 text-[15px]">
                  <span className="w-[52px] flex-none pt-0.5 text-[13px] font-bold text-soft" style={{ color }}>{label}</span>
                  {value || <i className="not-italic text-faint">—</i>}
                </p>
              );
              return (
                <div key={iso} className="py-3 first:pt-0 last:pb-0">
                  <h3 className="mb-1.5 flex items-center gap-2 font-serif text-[19px] font-bold">
                    {WEEKDAYS[d.getDay()]} <Tag tone={status === 'full' ? 'accent' : 'grey'}>{STATUS_LABEL[status]}</Tag>
                    <button className="ms-auto font-sans text-sm font-bold text-accent" onClick={() => { setDayIndex(i); setView('day'); }}>עריכה</button>
                  </h3>
                  {kids.map((kid) => line(kid.name, text(iso, 'sandwich', kid.id), kid.color))}
                  {line('צהריים', text(iso, 'lunch'))}
                  {line('ערב', text(iso, 'dinner'))}
                </div>
              );
            })}
          </section>
          <Button wide className="mb-2.5" onClick={fillWeek}>✨ הצע לי שבוע</Button>
          <p className="mb-3.5 px-0.5 text-sm text-soft">ממלא רק שדות ריקים, מתוך מנות וכריכים שכבר הזנתם. אפשר לשנות כל שדה אחר כך.</p>
          <Button variant="ghost" wide onClick={copyPreviousWeek}><Copy className="size-5" /> העתקת כל השבוע הקודם</Button>
        </>
      )}
    </>
  );
}
