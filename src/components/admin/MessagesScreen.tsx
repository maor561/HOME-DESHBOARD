import { Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNow } from '../../hooks/useNow';
import { pruneMessages, sendMessage, updateSettings } from '../../services/mutations';
import { store } from '../../services/store';
import { Avatar, Button, IconButton, ListRow, Panel, Picker, ScreenHeader, TextInput, Toggle, toast } from '../ui';
import { useFamily } from './shared';

const PRESETS = ['ארוחת ערב מוכנה!', 'יוצאים בעוד 5 דקות', 'למקלחות!', 'מי בא לעזור?'];
const DURATIONS: [number, string][] = [[5, '5 דקות'], [15, '15 דקות'], [30, '30 דקות'], [0, 'עד שאסיר']];

/** שליחת הודעה שקופצת מיד על המסך בבית, לזמן מוגבל. */
export function MessagesScreen() {
  const { db, settings } = useFamily();
  const now = useNow();
  const [text, setText] = useState('');
  const [minutes, setMinutes] = useState(15);
  const nowIso = now.toISOString();
  const live = db.messages.filter((m) => m.expiresAt === null || m.expiresAt > nowIso).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // ניקוי הודעות שתוקפן פג, פעם אחת בכניסה למסך
  useEffect(() => {
    void pruneMessages(store.getSnapshot());
  }, []);

  const send = async (value: string) => {
    if (!value.trim()) return;
    await sendMessage(value, 'הורים', minutes || null);
    setText('');
    toast('ההודעה מוצגת במסך');
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(text);
  };
  const remaining = (expiresAt: string | null) =>
    expiresAt === null ? 'עד שמסירים' : `עוד ${Math.max(1, Math.round((new Date(expiresAt).getTime() - now.getTime()) / 60_000))} דקות על המסך`;

  return (
    <>
      <ScreenHeader title="הודעה למסך" subtitle="ההודעה קופצת בתחתית המסך בבית, ונעלמת לבד" />
      {live.length > 0 && (
        <Panel title="מוצגת עכשיו">
          {live.map((message, i) => (
            <ListRow key={message.id} lead={<Avatar color="#ffbd66">📣</Avatar>} title={message.text} subtitle={`${message.sender} · ${i === 0 ? remaining(message.expiresAt) : 'מוסתרת מאחורי הודעה חדשה יותר'}`}>
              <IconButton label="הסרת ההודעה" danger onClick={() => store.remove('messages', message.id)}><Trash2 className="size-5" /></IconButton>
            </ListRow>
          ))}
        </Panel>
      )}
      <form className="mb-2.5 flex gap-2" onSubmit={submit}>
        <TextInput value={text} maxLength={80} placeholder="מה לכתוב על המסך?" aria-label="הודעה חדשה" onChange={(e) => setText(e.target.value)} />
        <Button className="h-[46px] px-4" disabled={!text.trim()}>שליחה</Button>
      </form>
      <div className="-mx-4 mb-3 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <span className="whitespace-nowrap text-[13px] font-bold text-soft">מוכנות:</span>
        {PRESETS.map((preset) => (
          <button key={preset} onClick={() => send(preset)} className="h-[34px] flex-none rounded-full bg-accent-soft px-3 text-sm font-bold text-accent">{preset}</button>
        ))}
      </div>
      <Panel title="כמה זמן להציג">
        <div className="pb-2.5"><Picker value={minutes} options={DURATIONS} onChange={setMinutes} /></div>
        <div className="flex items-center gap-3 py-2.5">
          <span className="flex-1"><b className="block">גם הילדים יכולים לשלוח</b><small className="text-sm text-soft">מהמסך האישי שלהם, לרבע שעה</small></span>
          <Toggle label="גם הילדים יכולים לשלוח" checked={settings.kidsCanMessage} onChange={(kidsCanMessage) => updateSettings(settings, { kidsCanMessage })} />
        </div>
      </Panel>
    </>
  );
}
