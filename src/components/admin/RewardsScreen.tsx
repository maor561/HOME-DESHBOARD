import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { FAMILY_ID } from '../../data/seed';
import { addStars, answerRewardRequest, uid } from '../../services/mutations';
import { store } from '../../services/store';
import type { FamilyMember, Reward } from '../../types';
import { Avatar, Button, IconButton, ListRow, Panel, Picker, ScreenHeader, Sheet, SheetActions, SheetLabel, TextInput, toast } from '../ui';
import { useFamily, type ScreenProps } from './shared';

const ICONS = ['🍦', '🎬', '🎳', '🍕', '🎮', '🧸', '🏊', '🎁', '🍫', '📱'];
const COSTS = [5, 10, 20, 30, 40, 50];

/** כוכבים ופרסים: בקשות שממתינות לאישור, החשבון של כל ילד, ורשימת הפרסים. */
export function RewardsScreen({ go }: ScreenProps) {
  const { db, members, memberById } = useFamily();
  const [draft, setDraft] = useState<(Reward & { isNew: boolean }) | null>(null);
  const [fixing, setFixing] = useState<{ member: FamilyMember; value: string } | null>(null);
  const pending = db.reward_requests.filter((r) => r.status === 'pending');
  const kids = members.filter((m) => m.getsSandwich || m.hasDevice || m.stars > 0);

  const save = async () => {
    if (!draft) return;
    const { isNew: _isNew, ...reward } = draft;
    await store.upsert('rewards', { ...reward, title: reward.title.trim() });
    setDraft(null);
    toast('הפרס נשמר');
  };
  const fix = async () => {
    if (!fixing) return;
    const target = Math.max(0, Math.round(Number(fixing.value)));
    if (Number.isNaN(target)) return;
    await addStars(fixing.member, target - fixing.member.stars, 'manual');
    setFixing(null);
    toast('מספר הכוכבים עודכן');
  };

  return (
    <>
      <ScreenHeader title="כוכבים ופרסים" subtitle="ילד מבקש פרס מהמסך שלו. אחרי האישור הכוכבים יורדים מהחשבון" onBack={() => go('more')} />
      {pending.map((request) => (
        <div key={request.id} className="mb-3.5 rounded-2xl bg-[#fff4d6] px-3.5 py-3 text-[15px] font-semibold">
          🎁 {memberById.get(request.memberId)?.name} ביקש/ה: <b>{request.title}</b> (⭐ {request.cost})
          <div className="mt-2 flex gap-2">
            <Button className="h-10 flex-1 text-sm" onClick={async () => { await answerRewardRequest(request, true); toast(`אושר · ירדו ${request.cost} כוכבים`); }}>אישור</Button>
            <Button variant="ghost" className="h-10 flex-1 text-sm" onClick={() => answerRewardRequest(request, false)}>לא הפעם</Button>
          </div>
        </div>
      ))}

      <Panel title="החשבון של כל ילד">
        {kids.map((member) => (
          <div key={member.id} className="flex min-h-[50px] items-center gap-3 py-1.5">
            <Avatar color={member.color}>{member.name[0]}</Avatar>
            <b className="flex-1 text-[17px]">{member.name}</b>
            <b className="text-[19px]">⭐ {member.stars}</b>
            <IconButton label="תיקון מספר הכוכבים" onClick={() => setFixing({ member, value: String(member.stars) })}><Pencil className="size-5" /></IconButton>
          </div>
        ))}
      </Panel>

      <Panel title="הפרסים">
        {!db.rewards.length && <p className="py-4 text-center text-soft">עוד לא הוגדרו פרסים</p>}
        {[...db.rewards].sort((a, b) => a.cost - b.cost).map((reward) => (
          <ListRow key={reward.id} lead={<Avatar>{reward.icon}</Avatar>} title={reward.title} subtitle={`⭐ ${reward.cost}${reward.memberId ? ` · רק ל${memberById.get(reward.memberId)?.name ?? ''}` : ''}`}>
            <IconButton label="עריכה" onClick={() => setDraft({ ...reward, isNew: false })}><Pencil className="size-5" /></IconButton>
          </ListRow>
        ))}
      </Panel>
      <Button wide onClick={() => setDraft({ id: uid(), familyId: FAMILY_ID, title: '', icon: ICONS[0], cost: 10, memberId: null, isNew: true })}><Plus className="size-5" /> פרס חדש</Button>

      {draft && (
        <Sheet title={draft.isNew ? 'פרס חדש' : 'עריכת פרס'} onClose={() => setDraft(null)}>
          <SheetLabel>מה הפרס</SheetLabel>
          <TextInput autoFocus value={draft.title} placeholder="למשל: גלידה, ערב סרט" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Picker label="כמה כוכבים" value={draft.cost} options={COSTS.map((cost) => [cost, `⭐ ${cost}`])} onChange={(cost) => setDraft({ ...draft, cost })} />
          <Picker label="אייקון" value={draft.icon} options={ICONS.map((icon) => [icon, icon])} onChange={(icon) => setDraft({ ...draft, icon })} />
          <Picker label="למי" value={draft.memberId ?? ''} options={[['', 'כל הילדים'], ...kids.map((m): [string, string] => [m.id, m.name])]} onChange={(id) => setDraft({ ...draft, memberId: id || null })} />
          <SheetActions onCancel={() => setDraft(null)} onSave={save} disabled={!draft.title.trim()}
            onDelete={draft.isNew ? undefined : async () => { await store.remove('rewards', draft.id); setDraft(null); toast('הפרס נמחק'); }} />
        </Sheet>
      )}
      {fixing && (
        <Sheet title={`הכוכבים של ${fixing.member.name}`} onClose={() => setFixing(null)}>
          <TextInput autoFocus inputMode="numeric" value={fixing.value} onChange={(e) => setFixing({ ...fixing, value: e.target.value.replace(/\D/g, '') })} />
          <SheetActions onCancel={() => setFixing(null)} onSave={fix} disabled={fixing.value === ''} />
        </Sheet>
      )}
    </>
  );
}
