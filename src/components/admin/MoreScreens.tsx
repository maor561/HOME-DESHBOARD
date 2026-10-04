import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { FAMILY_ID } from '../../data/seed';
import { upcomingBirthdays } from '../../lib/dates';
import { addPhotos, uid, updateSettings } from '../../services/mutations';
import { store } from '../../services/store';
import type { Birthday, DailyQuote, FamilyMember } from '../../types';
import { Avatar, Button, Field, IconButton, LinkRow, ListRow, Panel, Picker, ScreenHeader, Select, Sheet, SheetActions, SheetLabel, Tag, TextInput, Toggle, toast } from '../ui';
import { MEMBER_COLORS, useFamily, type ScreenProps } from './shared';

const formatBirth = (iso: string | null) => (iso ? iso.split('-').reverse().map(Number).join('.') : 'ללא תאריך');
const Swatch = ({ color }: { color: string }) => <span className="block size-5 rounded-full" style={{ background: color }} />;

export function MoreScreen({ go, onLock }: ScreenProps & { onLock: () => void }) {
  const { db } = useFamily();
  const pendingRewards = db.reward_requests.filter((r) => r.status === 'pending').length;
  return (
    <>
      <ScreenHeader title="עוד" />
      <Panel>
        <LinkRow icon="📣" title="הודעה למסך" subtitle="קופצת במסך בבית לזמן מוגבל" onClick={() => go('msg')} />
        <LinkRow icon="🎁" title="כוכבים ופרסים" subtitle={`${db.rewards.length} פרסים${pendingRewards ? ` · ${pendingRewards} בקשות ממתינות` : ''}`} onClick={() => go('rewards')} />
        <LinkRow icon="🛒" title="רשימת קניות" subtitle={`${db.shopping_items.filter((i) => !i.done).length} פריטים`} onClick={() => go('shop')} />
        <LinkRow icon="🗓️" title="לוח שנה" subtitle="חגים, חופשות, ימים מיוחדים ואירועים" onClick={() => go('cal')} />
        <LinkRow icon="👨‍👩‍👧‍👦" title="משפחה" subtitle={`${db.family_members.length} בני משפחה`} onClick={() => go('family')} />
        <LinkRow icon="🎂" title="ימי הולדת" subtitle={`המשפחה ועוד ${db.birthdays.length} אנשים`} onClick={() => go('bdays')} />
        <LinkRow icon="💬" title="משפט היום" subtitle={`${db.daily_quotes.filter((q) => q.active).length} פעילים במאגר`} onClick={() => go('quotes')} />
        <LinkRow icon="🖼️" title="תמונות" subtitle={`${db.photos.length} תמונות`} onClick={() => go('photos')} />
        <LinkRow icon="⚙️" title="הגדרות ותצוגה" subtitle="סגנון, מזג אוויר, לילה, קוד כניסה" onClick={() => go('settings')} />
      </Panel>
      <Button variant="ghost" wide onClick={onLock}>{store.mode === 'cloud' ? 'התנתקות' : '🔒 נעילה'}</Button>
    </>
  );
}

export function FamilyScreen({ go }: ScreenProps) {
  const { members } = useFamily();
  const [draft, setDraft] = useState<(FamilyMember & { isNew: boolean }) | null>(null);

  const save = async () => {
    if (!draft) return;
    const { isNew: _isNew, ...member } = draft;
    await store.upsert('family_members', { ...member, name: member.name.trim() });
    setDraft(null);
    toast('נשמר');
  };
  const remove = async () => {
    if (!draft) return;
    await store.remove('family_members', draft.id);
    setDraft(null);
    toast(`${draft.name} הוסר/ה מהרשימה`);
  };

  return (
    <>
      <ScreenHeader title="משפחה" onBack={() => go('more')} />
      <Panel>
        {members.map((m) => (
          <ListRow key={m.id} lead={<Avatar color={m.color}>{m.name[0]}</Avatar>} title={m.name} subtitle={`${formatBirth(m.birthDate)}${m.getsSandwich ? ' · כריך' : ''}${m.hasDevice ? ' · מסך אישי' : ''}${m.stars ? ` · ⭐ ${m.stars}` : ''}`}>
            <IconButton label="עריכה" onClick={() => setDraft({ ...m, isNew: false })}><Pencil className="size-5" /></IconButton>
          </ListRow>
        ))}
      </Panel>
      <Button variant="ghost" wide onClick={() => setDraft({ id: uid(), familyId: FAMILY_ID, name: '', birthDate: null, color: MEMBER_COLORS[members.length % MEMBER_COLORS.length], icon: null, getsSandwich: false, sortOrder: members.length, hasDevice: false, stars: 0, isNew: true })}>
        <Plus className="size-5" /> הוספת בן משפחה
      </Button>
      {draft && (
        <Sheet title={draft.isNew ? 'בן משפחה חדש' : draft.name} onClose={() => setDraft(null)}>
          <SheetLabel>שם</SheetLabel>
          <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <SheetLabel>תאריך לידה</SheetLabel>
          <TextInput type="date" value={draft.birthDate ?? ''} onChange={(e) => setDraft({ ...draft, birthDate: e.target.value || null })} />
          <Picker label="צבע" value={draft.color} options={MEMBER_COLORS.map((c) => [c, <Swatch color={c} />])} onChange={(color) => setDraft({ ...draft, color })} />
          <div className="mt-3 flex items-center gap-3">
            <span className="flex-1"><b className="block">כריך לבית הספר</b><small className="text-sm text-soft">יופיע בתפריט השבועי</small></span>
            <Toggle label="כריך לבית הספר" checked={draft.getsSandwich} onChange={(getsSandwich) => setDraft({ ...draft, getsSandwich })} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex-1"><b className="block">יש טלפון או טאבלט</b><small className="text-sm text-soft">אפשר לחבר לו/לה מסך אישי (‎/kid)</small></span>
            <Toggle label="יש טלפון או טאבלט" checked={draft.hasDevice} onChange={(hasDevice) => setDraft({ ...draft, hasDevice })} />
          </div>
          <SheetActions onCancel={() => setDraft(null)} onSave={save} disabled={!draft.name.trim()} onDelete={draft.isNew ? undefined : remove} />
        </Sheet>
      )}
    </>
  );
}

export function BirthdaysScreen({ go }: ScreenProps) {
  const { db, members } = useFamily();
  const [draft, setDraft] = useState<(Birthday & { isNew: boolean }) | null>(null);
  const now = new Date();
  const family = upcomingBirthdays(members, [], now, 99);
  const extra = upcomingBirthdays([], db.birthdays, now, 99);

  const save = async () => {
    if (!draft) return;
    const { isNew: _isNew, ...birthday } = draft;
    await store.upsert('birthdays', { ...birthday, name: birthday.name.trim() });
    setDraft(null);
    toast('יום ההולדת נשמר');
  };
  const remove = async (id: string) => {
    await store.remove('birthdays', id);
    setDraft(null);
    toast('נמחק');
  };

  return (
    <>
      <ScreenHeader title="ימי הולדת" subtitle="המסך מציג את שלושת הקרובים ביותר" onBack={() => go('more')} />
      <Panel title="בני המשפחה" action="מתעדכן אוטומטית">
        {family.map((b) => (
          <ListRow key={b.id} lead={<Avatar color={b.color}>{b.name[0]}</Avatar>} title={b.name} subtitle={`${b.shortDate} · גיל ${b.age} · בעוד ${b.days} ימים`} />
        ))}
      </Panel>
      <Panel title="אנשים נוספים">
        {!extra.length && <p className="py-4 text-center text-soft">סבא, סבתא, חברים מהגן...</p>}
        {extra.map((b) => (
          <ListRow key={b.id} lead={<Avatar color={b.color}>🎂</Avatar>} title={b.name} subtitle={`${b.shortDate}${b.age === null ? '' : ` · גיל ${b.age}`} · בעוד ${b.days} ימים`}>
            <IconButton label="עריכה" onClick={() => setDraft({ ...db.birthdays.find((x) => x.id === b.id)!, isNew: false })}><Pencil className="size-5" /></IconButton>
            <IconButton label="מחיקה" danger onClick={() => remove(b.id)}><Trash2 className="size-5" /></IconButton>
          </ListRow>
        ))}
      </Panel>
      <Button wide onClick={() => setDraft({ id: uid(), familyId: FAMILY_ID, name: '', birthDate: '', yearKnown: true, icon: '🎂', color: '#c98a3a', isNew: true })}>
        <Plus className="size-5" /> הוספת יום הולדת
      </Button>
      {draft && (
        <Sheet title="יום הולדת" onClose={() => setDraft(null)}>
          <SheetLabel>שם</SheetLabel>
          <TextInput value={draft.name} placeholder="למשל: סבתא, חבר מהגן" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <SheetLabel>תאריך לידה</SheetLabel>
          <TextInput type="date" value={draft.birthDate} onChange={(e) => setDraft({ ...draft, birthDate: e.target.value })} />
          <div className="mt-3 flex items-center gap-3">
            <span className="flex-1"><b className="block">השנה לא ידועה</b><small className="text-sm text-soft">יוצג בלי גיל</small></span>
            <Toggle label="השנה לא ידועה" checked={!draft.yearKnown} onChange={(unknown) => setDraft({ ...draft, yearKnown: !unknown })} />
          </div>
          <SheetActions onCancel={() => setDraft(null)} onSave={save} disabled={!draft.name.trim() || !draft.birthDate} onDelete={draft.isNew ? undefined : () => remove(draft.id)} />
        </Sheet>
      )}
    </>
  );
}

export function QuotesScreen({ go }: ScreenProps) {
  const { db } = useFamily();
  const [draft, setDraft] = useState<(DailyQuote & { isNew: boolean }) | null>(null);

  const save = async () => {
    if (!draft) return;
    const { isNew: _isNew, ...quote } = draft;
    await store.upsert('daily_quotes', { ...quote, text: quote.text.trim() });
    setDraft(null);
    toast('המשפט נשמר');
  };

  return (
    <>
      <ScreenHeader title="משפט היום" subtitle="כל יום נבחר משפט פעיל מהמאגר, אלא אם נקבע משפט לתאריך" onBack={() => go('more')} />
      <section className="mb-3.5 divide-y divide-line rounded-[20px] bg-card px-4 py-1.5 shadow-[0_1px_0_var(--color-line)]">
        {db.daily_quotes.map((q) => (
          <div key={q.id} className="flex items-center gap-2 py-3">
            <button className="min-w-0 flex-1 text-start" onClick={() => setDraft({ ...q, isNew: false })}>
              <b className="block font-serif text-[17px]">״{q.text}״</b>
              {q.date && <Tag>נקבע ל-{formatBirth(q.date)}</Tag>}
            </button>
            <Toggle label="פעיל" checked={q.active} onChange={(active) => store.upsert('daily_quotes', { ...q, active })} />
          </div>
        ))}
      </section>
      <Button wide onClick={() => setDraft({ id: uid(), familyId: FAMILY_ID, text: '', active: true, date: null, isNew: true })}><Plus className="size-5" /> משפט חדש</Button>
      {draft && (
        <Sheet title={draft.isNew ? 'משפט חדש' : 'עריכת משפט'} onClose={() => setDraft(null)}>
          <TextInput autoFocus value={draft.text} placeholder="משפט מעורר השראה" onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          <SheetLabel>להציג בתאריך מסוים (לא חובה)</SheetLabel>
          <TextInput type="date" value={draft.date ?? ''} onChange={(e) => setDraft({ ...draft, date: e.target.value || null })} />
          <SheetActions onCancel={() => setDraft(null)} onSave={save} disabled={!draft.text.trim()}
            onDelete={draft.isNew ? undefined : async () => { await store.remove('daily_quotes', draft.id); setDraft(null); toast('המשפט נמחק'); }} />
        </Sheet>
      )}
    </>
  );
}

export function PhotosScreen({ go }: ScreenProps) {
  const { db, settings } = useFamily();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const added = await addPhotos([...files]);
      toast(`נוספו ${added} תמונות`);
    } catch {
      toast('אין מספיק מקום במכשיר. אפשר למחוק תמונות ישנות; בענן לא תהיה מגבלה');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <ScreenHeader title="תמונות" onBack={() => go('more')} />
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <Button wide className="mb-3.5" disabled={busy} onClick={() => input.current?.click()}><Upload className="size-5" /> {busy ? 'מעלה…' : 'העלאה מהטלפון'}</Button>
      <Panel title="במסך עכשיו" action={`${db.photos.length} תמונות`}>
        {!db.photos.length && <p className="py-6 text-center text-soft">עוד אין תמונות</p>}
        <div className="grid grid-cols-3 gap-2 !border-0">
          {db.photos.map((photo) => (
            <div key={photo.id} className="relative">
              <img src={photo.url} alt="" className="aspect-square w-full rounded-[14px] bg-line object-cover" />
              <button aria-label="מחיקת תמונה" onClick={() => store.remove('photos', photo.id)} className="absolute end-1 top-1 grid size-8 place-items-center rounded-full bg-black/55 text-white">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="הצגה">
        <Field label="החלפה כל" wide>
          <Select value={settings.photoIntervalSec} onChange={(e) => updateSettings(settings, { photoIntervalSec: Number(e.target.value) })}>
            <option value={15}>15 שניות</option><option value={30}>30 שניות</option><option value={60}>דקה</option><option value={300}>5 דקות</option>
          </Select>
        </Field>
        <div className="flex items-center gap-3 py-2.5">
          <b className="flex-1">סדר אקראי</b>
          <Toggle label="סדר אקראי" checked={settings.photoShuffle} onChange={(photoShuffle) => updateSettings(settings, { photoShuffle })} />
        </div>
      </Panel>
    </>
  );
}
