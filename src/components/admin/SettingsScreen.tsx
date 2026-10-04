import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEFAULT_ROUTINE, FAMILY_ID } from '../../data/seed';
import { geocodeCity, uid, updateSettings } from '../../services/mutations';
import { store } from '../../services/store';
import type { PairedDevice, SupabaseStore } from '../../services/supabaseStore';
import type { DashboardStyle, WidgetKey } from '../../types';
import { Button, Field, IconButton, ListRow, Panel, Picker, ScreenHeader, Select, TextInput, Toggle, toast, useDraft } from '../ui';
import { useFamily, type ScreenProps } from './shared';

const WIDGET_LABEL: Record<WidgetKey, string> = {
  weather: 'מזג אוויר', sun: 'זריחה ושקיעה', calendar: 'לוח שנה שבועי ותחזית', sandwiches: 'כריכים למחר', meals: 'מה אוכלים היום', activities: 'חוגים',
  tasks: 'משימות', birthdays: 'ימי הולדת קרובים', photos: 'תמונות מתחלפות', quote: 'משפט היום',
};

function StylePreview({ style }: { style: DashboardStyle }) {
  if (style === 'glass') {
    return (
      <div className="admin-sky relative mb-2 h-[86px] overflow-hidden rounded-xl">
        {['inset-[10px_10px_auto_52%] h-[30px]', 'inset-[46px_10px_10px_52%]', 'inset-[10px_52%_44px_10px]', 'inset-[50px_52%_10px_10px]'].map((pos) => (
          <i key={pos} className={`absolute rounded-md border border-white/35 bg-white/20 ${pos}`} />
        ))}
      </div>
    );
  }
  return (
    <div className="relative mb-2 h-[86px] overflow-hidden rounded-xl bg-[#e7dccb]">
      <i className="absolute inset-[8px_8px_auto_60%] h-[34px] rounded-[20px_20px_2px_2px] border-[3px] border-white bg-[#7fb6ea]" />
      <i className="absolute inset-[48px_30%_8px_34%] -rotate-2 bg-[#dcebf7] shadow" />
      <i className="absolute inset-[44px_72%_8px_8px] rotate-2 bg-[#fff3a8] shadow" />
      <i className="absolute inset-[8px_68%_46px_10px] -rotate-3 bg-white shadow" />
    </div>
  );
}

/** ההכנות של כל ילד לשגרת הערב. לכל ילד רשימה משלו. */
function RoutineEditor() {
  const { db, members } = useFamily();
  const kids = members.filter((m) => m.getsSandwich || db.routine_items.some((item) => item.memberId === m.id));
  const [kidId, setKidId] = useState(kids[0]?.id ?? '');
  const [text, setText] = useState('');
  const items = db.routine_items.filter((item) => item.memberId === kidId).sort((a, b) => a.sortOrder - b.sortOrder);

  const add = async (value: string, order = items.length) => {
    if (!value.trim() || !kidId) return;
    await store.upsert('routine_items', { id: uid(), familyId: FAMILY_ID, memberId: kidId, text: value.trim(), sortOrder: order });
  };

  return (
    <div className="py-2.5">
      <Picker label="ההכנות של" value={kidId} options={kids.map((m) => [m.id, m.name])} onChange={setKidId} />
      <div className="mt-2 divide-y divide-line">
        {items.map((item) => (
          <div key={item.id} className="flex min-h-[46px] items-center gap-2 py-1">
            <b className="flex-1">{item.text}</b>
            <IconButton label={`הסרת ${item.text}`} danger onClick={() => store.remove('routine_items', item.id)}><Trash2 className="size-5" /></IconButton>
          </div>
        ))}
      </div>
      {!items.length && (
        <Button variant="ghost" wide className="mt-1 h-11 text-sm" onClick={async () => { for (const [i, value] of DEFAULT_ROUTINE.entries()) await add(value, i); }}>
          להתחיל מרשימה מוכנה
        </Button>
      )}
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(text).then(() => setText('')); }}>
        <TextInput value={text} placeholder="הכנה נוספת" aria-label="הכנה נוספת" onChange={(e) => setText(e.target.value)} />
        <Button className="h-[46px] px-3.5 text-sm" disabled={!text.trim()}>הוספה</Button>
      </form>
    </div>
  );
}

/** המסכים שחוברו בסריקת QR. הסרת מסך מנתקת אותו, והוא יציג שוב קוד לחיבור. */
function PairedScreens() {
  const cloud = store as SupabaseStore;
  const { db } = useFamily();
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const load = () => void cloud.listDevices().then(setDevices);
  useEffect(load, []);

  return (
    <Panel title="מסכים מחוברים">
      {!devices.length && <p className="py-3 text-sm text-soft">עוד לא חובר מסך. פותחים את ‎/dashboard במסך, וסורקים את הקוד שמופיע בו.</p>}
      {devices.map((device) => (
        <ListRow key={device.userId} title={device.memberId ? `המסך של ${db.family_members.find((m) => m.id === device.memberId)?.name ?? device.name}` : device.name} subtitle={`חובר ב-${new Date(device.createdAt).toLocaleDateString('he-IL')}`}>
          <IconButton label="ניתוק המסך" danger onClick={async () => { await cloud.removeDevice(device.userId); toast('המסך נותק'); load(); }}>
            <Trash2 className="size-5" />
          </IconButton>
        </ListRow>
      ))}
    </Panel>
  );
}

/** הגדרות המסך: סגנון, מיקום, לילה מעומעם, אילו כרטיסים מוצגים וקוד הכניסה. */
export function SettingsScreen({ go }: ScreenProps) {
  const { db, settings } = useFamily();
  const family = db.families[0];
  const [city, setCity] = useDraft(settings.city);
  const [pin, setPin] = useState('');
  const save = (patch: Parameters<typeof updateSettings>[1]) => updateSettings(settings, patch);

  const saveCity = async () => {
    const found = await geocodeCity(city.trim()).catch(() => null);
    if (!found) return toast('לא מצאתי את העיר. נסו שם אחר');
    await save({ city: city.trim(), latitude: found.latitude, longitude: found.longitude });
    toast(`מזג האוויר עודכן ל${found.name}`);
  };
  const savePin = async () => {
    await save({ pin });
    setPin('');
    toast('קוד הכניסה הוחלף');
  };

  return (
    <>
      <ScreenHeader title="הגדרות ותצוגה" onBack={() => go('more')} />
      <Panel title="סגנון המסך">
        <div className="grid grid-cols-2 gap-2.5">
          {([['glass', 'זכוכית ושמיים'], ['board', 'לוח המקרר']] as [DashboardStyle, string][]).map(([style, name]) => (
            <button key={style} aria-pressed={settings.style === style} onClick={() => save({ style })}
              className={`rounded-[18px] border-[2.5px] p-2 pb-2.5 font-bold ${settings.style === style ? 'border-accent bg-accent-soft' : 'border-transparent bg-paper'}`}>
              <StylePreview style={style} />
              {name}
            </button>
          ))}
        </div>
        {settings.style === 'board' && (
          <Field label="כתב הפתקים" wide>
            <Select value={settings.boardFont} onChange={(e) => save({ boardFont: e.target.value as 'hand' | 'print' })}>
              <option value="hand">כתב יד</option>
              <option value="print">דפוס (קריא יותר מרחוק)</option>
            </Select>
          </Field>
        )}
      </Panel>

      <Panel title="כללי">
        <Field label="שם המשפחה" wide><TextInput value={family.name} onChange={(e) => store.upsert('families', { ...family, name: e.target.value })} /></Field>
        <Field label="עיר" wide>
          <TextInput value={city} onChange={(e) => setCity(e.target.value)} />
          {city.trim() !== settings.city && <Button className="h-[46px] px-3.5 text-sm" onClick={saveCity}>עדכון</Button>}
        </Field>
        <Field label="יחידות" wide>
          <Select value={settings.units} onChange={(e) => save({ units: e.target.value as 'c' | 'f' })}><option value="c">צלזיוס</option><option value="f">פרנהייט</option></Select>
        </Field>
        <Field label="גודל טקסט" wide>
          <Select value={settings.textScale} onChange={(e) => save({ textScale: Number(e.target.value) })}><option value={1}>רגיל</option><option value={1.08}>גדול</option><option value={1.16}>גדול מאוד</option></Select>
        </Field>
      </Panel>

      <Panel title="מצב בוקר">
        <div className="flex items-center gap-3 py-2.5">
          <span className="flex-1"><b className="block">מסך יציאה מהבית</b><small className="text-sm text-soft">כריך, מה להביא וחוג לכל ילד</small></span>
          <Toggle label="מצב בוקר" checked={settings.morning.enabled} onChange={(enabled) => save({ morning: { ...settings.morning, enabled } })} />
        </div>
        <div className="grid grid-cols-2 gap-2.5 py-2.5">
          <label className="text-[13px] font-bold text-soft">מתחיל ב-<TextInput type="time" className="mt-1.5" value={settings.morning.from} onChange={(e) => save({ morning: { ...settings.morning, from: e.target.value } })} /></label>
          <label className="text-[13px] font-bold text-soft">שעת יציאה<TextInput type="time" className="mt-1.5" value={settings.morning.leave} onChange={(e) => save({ morning: { ...settings.morning, leave: e.target.value } })} /></label>
        </div>
        <div className="pb-2.5">
          <Picker
            label="בימים"
            value={settings.morning.days}
            options={['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((letter, i) => [i, letter])}
            onChange={(day) => save({ morning: { ...settings.morning, days: settings.morning.days.includes(day) ? settings.morning.days.filter((d) => d !== day) : [...settings.morning.days, day].sort() } })}
          />
        </div>
      </Panel>

      <Panel title="מצב ערב · מתכוננים למחר">
        <div className="flex items-center gap-3 py-2.5">
          <span className="flex-1"><b className="block">רשימת הכנות לכל ילד</b><small className="text-sm text-soft">המסך חוזר לרגיל כשכולם מוכנים</small></span>
          <Toggle label="מצב ערב" checked={settings.evening.enabled} onChange={(enabled) => save({ evening: { ...settings.evening, enabled } })} />
        </div>
        <div className="grid grid-cols-2 gap-2.5 py-2.5">
          <label className="text-[13px] font-bold text-soft">מתחיל ב-<TextInput type="time" className="mt-1.5" value={settings.evening.from} onChange={(e) => save({ evening: { ...settings.evening, from: e.target.value } })} /></label>
          <label className="text-[13px] font-bold text-soft">עד<TextInput type="time" className="mt-1.5" value={settings.evening.to} onChange={(e) => save({ evening: { ...settings.evening, to: e.target.value } })} /></label>
        </div>
        <div className="pb-2.5">
          <Picker
            label="בערבים"
            value={settings.evening.days}
            options={['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((letter, i) => [i, letter])}
            onChange={(day) => save({ evening: { ...settings.evening, days: settings.evening.days.includes(day) ? settings.evening.days.filter((d) => d !== day) : [...settings.evening.days, day].sort() } })}
          />
        </div>
        <RoutineEditor />
      </Panel>

      <Panel title="סיכום שבועי">
        <div className="flex items-center gap-3 py-2.5">
          <span className="flex-1"><b className="block">"השבוע שלנו" בשבת</b><small className="text-sm text-soft">כוכבים, משימות ומה מחכה בשבוע הבא</small></span>
          <Toggle label="סיכום שבועי" checked={settings.summary.enabled} onChange={(enabled) => save({ summary: { ...settings.summary, enabled } })} />
        </div>
        <div className="grid grid-cols-2 gap-2.5 py-2.5">
          <label className="text-[13px] font-bold text-soft">מוצג מ-<TextInput type="time" className="mt-1.5" value={settings.summary.from} onChange={(e) => save({ summary: { ...settings.summary, from: e.target.value } })} /></label>
          <label className="text-[13px] font-bold text-soft">עד<TextInput type="time" className="mt-1.5" value={settings.summary.to} onChange={(e) => save({ summary: { ...settings.summary, to: e.target.value } })} /></label>
        </div>
      </Panel>

      <Panel title="לילה מעומעם">
        <div className="flex items-center gap-3 py-2.5">
          <span className="flex-1"><b className="block">שעון בלבד בלילה</b><small className="text-sm text-soft">כדי לא להאיר את הסלון</small></span>
          <Toggle label="לילה מעומעם" checked={settings.nightDim.enabled} onChange={(enabled) => save({ nightDim: { ...settings.nightDim, enabled } })} />
        </div>
        <div className="grid grid-cols-2 gap-2.5 pt-2.5">
          <TextInput type="time" aria-label="משעה" value={settings.nightDim.from} onChange={(e) => save({ nightDim: { ...settings.nightDim, from: e.target.value } })} />
          <TextInput type="time" aria-label="עד שעה" value={settings.nightDim.to} onChange={(e) => save({ nightDim: { ...settings.nightDim, to: e.target.value } })} />
        </div>
      </Panel>

      <Panel title="מה מוצג במסך">
        {/* הסינון מסתיר כרטיסים שהוסרו מהמערכת אבל עוד שמורים בהגדרות ישנות */}
        {settings.widgets.filter((widget) => widget.key in WIDGET_LABEL).map((widget) => (
          <div key={widget.key} className="flex min-h-[50px] items-center gap-3 py-1.5">
            <b className="flex-1">{WIDGET_LABEL[widget.key]}</b>
            <Toggle
              label={WIDGET_LABEL[widget.key]}
              checked={widget.visible}
              onChange={(visible) => save({ widgets: settings.widgets.map((w) => (w.key === widget.key ? { ...w, visible } : w)) })}
            />
          </div>
        ))}
      </Panel>

      {store.mode === 'local' && <Panel title="קוד כניסה">
        <Field label="קוד חדש" wide>
          <TextInput inputMode="numeric" maxLength={4} placeholder="4 ספרות" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          <Button className="h-[46px] px-3.5 text-sm" disabled={pin.length !== 4} onClick={savePin}>החלפה</Button>
        </Field>
      </Panel>}

      {store.mode === 'cloud' && <PairedScreens />}

      {store.mode === 'cloud' ? (
        <Panel title="נתונים"><div className="py-2.5"><b className="block">מסונכרן בענן</b><small className="text-sm text-soft">כל שינוי מגיע מיד לכל המכשירים.</small></div></Panel>
      ) : <Panel title="נתונים">
        <div className="py-2.5"><b className="block">שמירה מקומית</b><small className="text-sm text-soft">הנתונים נשמרים בדפדפן של המכשיר הזה בלבד.</small></div>
        <Button variant="danger" wide className="h-11 text-sm" onClick={async () => { if (window.confirm('להחזיר את כל הנתונים לנתוני הפתיחה? הפעולה מוחקת את מה שהוזן.')) { await store.reset(); toast('הנתונים אופסו'); } }}>
          איפוס לנתוני הפתיחה
        </Button>
      </Panel>}
    </>
  );
}
