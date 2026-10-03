import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { geocodeCity, updateSettings } from '../../services/mutations';
import { store } from '../../services/store';
import type { PairedDevice, SupabaseStore } from '../../services/supabaseStore';
import type { DashboardStyle, WidgetKey } from '../../types';
import { Button, Field, IconButton, ListRow, Panel, ScreenHeader, Select, TextInput, Toggle, toast, useDraft } from '../ui';
import { useFamily, type ScreenProps } from './shared';

const WIDGET_LABEL: Record<WidgetKey, string> = {
  weather: 'מזג אוויר', sun: 'זריחה ושקיעה', calendar: 'לוח שנה שבועי ותחזית', sandwiches: 'כריכים למחר', meals: 'מה אוכלים היום', activities: 'חוגים',
  tasks: 'משימות', birthdays: 'ימי הולדת קרובים', photos: 'תמונות מתחלפות', quote: 'משפט היום', home: 'מצב הבית (אין חיישן עדיין)',
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

/** המסכים שחוברו בסריקת QR. הסרת מסך מנתקת אותו, והוא יציג שוב קוד לחיבור. */
function PairedScreens() {
  const cloud = store as SupabaseStore;
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const load = () => void cloud.listDevices().then(setDevices);
  useEffect(load, []);

  return (
    <Panel title="מסכים מחוברים">
      {!devices.length && <p className="py-3 text-sm text-soft">עוד לא חובר מסך. פותחים את ‎/dashboard במסך, וסורקים את הקוד שמופיע בו.</p>}
      {devices.map((device) => (
        <ListRow key={device.userId} title={device.name} subtitle={`חובר ב-${new Date(device.createdAt).toLocaleDateString('he-IL')}`}>
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
        {settings.widgets.map((widget) => (
          <div key={widget.key} className="flex min-h-[50px] items-center gap-3 py-1.5">
            <b className="flex-1">{WIDGET_LABEL[widget.key]}</b>
            <Toggle
              label={WIDGET_LABEL[widget.key]}
              checked={widget.visible}
              onChange={(visible) => widget.key !== 'home' && save({ widgets: settings.widgets.map((w) => (w.key === widget.key ? { ...w, visible } : w)) })}
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
