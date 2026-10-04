import { Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { addShoppingItem, clearBoughtItems, frequentItems, rememberItem, toggleShoppingItem } from '../../services/mutations';
import type { ShoppingItem } from '../../types';
import { Button, ScreenHeader, Tag, TextInput, toast } from '../ui';
import { useFamily } from './shared';

function ItemRow({ item, addedBy }: { item: ShoppingItem; addedBy?: string }) {
  return (
    <div className="flex min-h-[50px] items-center gap-3 py-1.5">
      <button role="checkbox" aria-checked={item.done} aria-label={item.done ? `החזרה לרשימה: ${item.text}` : `נקנה: ${item.text}`} onClick={() => toggleShoppingItem(item)}
        className={`grid size-7 flex-none place-items-center rounded-[9px] border-2 ${item.done ? 'border-ok bg-ok text-white' : 'border-faint text-transparent'}`}>
        <Check className="size-4" strokeWidth={3} />
      </button>
      <b className={`min-w-0 flex-1 truncate text-[17px] ${item.done ? 'font-medium text-faint line-through' : 'font-bold'}`}>{item.text}</b>
      {addedBy && !item.done && <Tag tone="grey">{addedBy}</Tag>}
    </div>
  );
}

/** רשימת הקניות המשפחתית. במסך בבית היא מתחלפת עם כרטיס המשימות, כל עוד יש בה פריטים. */
export function ShoppingScreen() {
  const { db, memberById } = useFamily();
  const [text, setText] = useState('');
  const open = db.shopping_items.filter((i) => !i.done).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const bought = db.shopping_items.filter((i) => i.done);
  const onList = new Set(open.map((i) => i.text));
  const frequent = frequentItems().filter((item) => !onList.has(item));

  const add = async (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    if (onList.has(clean)) return toast('כבר ברשימה');
    await addShoppingItem(clean);
    rememberItem(clean);
    setText('');
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void add(text);
  };

  return (
    <>
      <ScreenHeader title="רשימת קניות" subtitle="מופיעה במסך לסירוגין עם המשימות, כל עוד יש בה פריטים" />
      <form className="mb-2.5 flex gap-2" onSubmit={submit}>
        <TextInput value={text} placeholder="מה חסר?" aria-label="פריט חדש" onChange={(e) => setText(e.target.value)} />
        <Button className="h-[46px] px-4" disabled={!text.trim()}>הוספה</Button>
      </form>
      {frequent.length > 0 && (
        <div className="-mx-4 mb-2 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <span className="whitespace-nowrap text-[13px] font-bold text-soft">קונים הרבה:</span>
          {frequent.map((item) => (
            <button key={item} onClick={() => add(item)} className="h-[34px] flex-none rounded-full bg-accent-soft px-3 text-sm font-bold text-accent">+ {item}</button>
          ))}
        </div>
      )}

      <section className="mb-3.5 divide-y divide-line rounded-[20px] bg-card px-4 py-1.5 shadow-[0_1px_0_var(--color-line)]">
        {!open.length && <p className="py-8 text-center text-soft">הרשימה ריקה</p>}
        {open.map((item) => <ItemRow key={item.id} item={item} addedBy={item.addedBy ? memberById.get(item.addedBy)?.name : undefined} />)}
      </section>

      {bought.length > 0 && (
        <>
          <div className="mx-0.5 mb-2 flex text-[13px] font-bold tracking-widest text-soft">
            נקנו ({bought.length})
            <button className="ms-auto tracking-normal text-accent" onClick={async () => { await clearBoughtItems(db); toast('הרשימה נוקתה'); }}>ניקוי</button>
          </div>
          <section className="mb-3.5 divide-y divide-line rounded-[20px] bg-card px-4 py-1.5 shadow-[0_1px_0_var(--color-line)]">
            {bought.map((item) => <ItemRow key={item.id} item={item} />)}
          </section>
        </>
      )}
    </>
  );
}
