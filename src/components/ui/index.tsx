import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import type { FamilyMember } from '../../types';

/* ערכת רכיבי הממשק של ה-Admin. מותאמת למגע: כל יעד לחיצה בגובה 40px לפחות. */

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

export function ScreenHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <header className="sticky top-0 z-[5] bg-gradient-to-b from-paper from-80% to-transparent pb-3 pt-[18px]">
      <div className="flex items-center gap-2.5">
        {onBack && (
          <button onClick={onBack} aria-label="חזרה" className="grid size-11 place-items-center rounded-[14px] bg-card shadow-[0_1px_0_var(--color-line)]">
            <ChevronRight className="size-5" />
          </button>
        )}
        <h1 className="flex-1 font-serif text-[28px] font-bold leading-tight">{title}</h1>
      </div>
      {subtitle && <p className="mt-1 text-[15px] text-soft">{subtitle}</p>}
    </header>
  );
}

export function Panel({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-3.5 rounded-[20px] bg-card p-4 shadow-[0_1px_0_var(--color-line),0_8px_24px_rgba(60,40,10,.05)]">
      {title && (
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-bold tracking-widest text-soft">
          <span className="size-[7px] rounded-full bg-accent" />
          {title}
          {action && <span className="ms-auto text-[13px] tracking-normal text-accent">{action}</span>}
        </h2>
      )}
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

export function ListRow({ lead, title, subtitle, children, muted }: { lead?: ReactNode; title: ReactNode; subtitle?: ReactNode; children?: ReactNode; muted?: boolean }) {
  return (
    <div className="flex min-h-14 items-center gap-3 py-2.5">
      {lead}
      <div className="min-w-0 flex-1">
        <b className={cx('block truncate text-[17px] font-bold', muted && 'text-faint line-through')}>{title}</b>
        {subtitle && <small className="block truncate text-sm text-soft">{subtitle}</small>}
      </div>
      {children}
    </div>
  );
}

export function Avatar({ color = 'var(--color-accent-soft)', children }: { color?: string; children: ReactNode }) {
  return <span className="grid size-[42px] flex-none place-items-center rounded-full text-lg font-bold text-white" style={{ background: color }}>{children}</span>;
}

export function MemberChip({ member }: { member: FamilyMember }) {
  return <span className="inline-flex min-w-[58px] flex-none items-center justify-center whitespace-nowrap rounded-full px-3 py-0.5 text-sm font-bold text-white" style={{ background: member.color }}>{member.name}</span>;
}

export function Tag({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'grey' }) {
  return <span className={cx('whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-line text-soft')}>{children}</span>;
}

const FIELD = 'h-[46px] min-w-0 rounded-[14px] border-[1.5px] border-line bg-white px-3 font-semibold placeholder:font-medium placeholder:text-faint focus:border-transparent focus:outline-2 focus:outline-accent';

/** שדה טקסט ששומר בזמן ההקלדה: המסך בבית מתעדכן תוך כדי כתיבה. */
export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(FIELD, 'w-full', className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(FIELD, 'w-full', className)}>{children}</select>;
}

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className="flex items-center gap-2.5 py-1.5">
      <span className={cx('flex-none text-sm font-bold text-soft', wide ? 'w-[92px]' : 'w-[58px]')}>{label}</span>
      {children}
    </label>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'ghost' | 'danger';
  wide?: boolean;
}

export function Button({ variant = 'solid', wide, className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex h-[50px] items-center justify-center gap-2 rounded-2xl px-5 font-bold disabled:opacity-50',
        variant === 'solid' && 'bg-accent text-white',
        variant === 'ghost' && 'bg-accent-soft text-accent',
        variant === 'danger' && 'text-danger',
        wide && 'w-full',
        className,
      )}
    />
  );
}

export function IconButton({ label, danger, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; danger?: boolean }) {
  return <button {...props} aria-label={label} title={label} className={cx('grid size-10 flex-none place-items-center rounded-xl active:bg-line', danger ? 'text-danger' : 'text-soft', className)} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx('relative h-[30px] w-[50px] flex-none rounded-full transition-colors', checked ? 'bg-ok' : 'bg-faint')}>
      <span className={cx('absolute start-[3px] top-[3px] size-6 rounded-full bg-white transition-transform', checked && '-translate-x-5')} />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (next: T) => void }) {
  return (
    <div className="mb-3.5 flex rounded-[14px] bg-line p-1">
      {options.map(([key, label]) => (
        <button key={key} aria-pressed={key === value} onClick={() => onChange(key)} className={cx('h-10 flex-1 rounded-[11px] font-bold', key === value ? 'bg-card text-ink shadow-sm' : 'text-soft')}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** קבוצת בחירה בכפתורים גדולים: בחירה יחידה או מרובה. */
export function Picker<T extends string | number>({ value, options, onChange, label }: { value: T | T[]; options: [T, ReactNode][]; onChange: (next: T) => void; label?: string }) {
  const selected = (key: T) => (Array.isArray(value) ? value.includes(key) : value === key);
  return (
    <div>
      {label && <div className="mb-1.5 mt-3 text-[13px] font-bold text-soft">{label}</div>}
      <div className="flex flex-wrap gap-[7px]">
        {options.map(([key, text]) => (
          <button key={String(key)} type="button" aria-pressed={selected(key)} onClick={() => onChange(key)}
            className={cx('h-11 min-w-[46px] rounded-[13px] border-2 px-3 font-bold shadow-[0_1px_0_var(--color-line)]', selected(key) ? 'border-accent bg-accent-soft' : 'border-transparent bg-card')}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SheetLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 mt-3 text-[13px] font-bold text-soft">{children}</div>;
}

/** גיליון תחתון לטפסים, בסגנון iOS. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-10 flex items-end bg-[rgba(20,16,10,.45)]" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="sheet-up max-h-[88%] w-full overflow-y-auto rounded-t-[26px] bg-paper px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-2.5">
        <div className="mx-auto mb-3 h-[5px] w-11 rounded-full bg-faint" />
        <h2 className="mb-3 font-serif text-2xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function SheetActions({ onCancel, onSave, saveLabel = 'שמירה', disabled, onDelete }: { onCancel: () => void; onSave: () => void; saveLabel?: string; disabled?: boolean; onDelete?: () => void }) {
  return (
    <>
      <div className="mt-[18px] grid grid-cols-2 gap-2.5">
        <Button variant="ghost" onClick={onCancel}>ביטול</Button>
        <Button onClick={onSave} disabled={disabled}>{saveLabel}</Button>
      </div>
      {onDelete && <Button variant="danger" wide className="mt-2 h-10 text-sm" onClick={onDelete}>מחיקה</Button>}
    </>
  );
}

export function Fab({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button aria-label={label} onClick={onClick} className="absolute bottom-[88px] end-[18px] z-[6] grid size-[60px] place-items-center rounded-[20px] bg-accent text-white shadow-[0_10px_24px_rgba(194,80,28,.4)]">
      {children}
    </button>
  );
}

export function LinkRow({ icon, title, subtitle, onClick }: { icon: string; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-14 w-full items-center gap-3 py-2.5 text-start">
      <Avatar>{icon}</Avatar>
      <span className="min-w-0 flex-1"><b className="block text-[17px] font-bold">{title}</b><small className="block truncate text-sm text-soft">{subtitle}</small></span>
      <ChevronLeft className="size-5 text-faint" />
    </button>
  );
}

/* ---------- הודעות קצרות ---------- */
let toastMessage = '';
let toastTimer = 0;
const toastListeners = new Set<() => void>();
const emitToast = () => toastListeners.forEach((l) => l());

export function toast(message: string): void {
  toastMessage = message;
  emitToast();
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastMessage = '';
    emitToast();
  }, 2200);
}

export function Toaster() {
  const message = useSyncExternalStore((l) => (toastListeners.add(l), () => toastListeners.delete(l)), () => toastMessage);
  if (!message) return null;
  return <div role="status" className="sheet-up absolute inset-x-4 bottom-[92px] z-30 rounded-[14px] bg-ink px-4 py-3 text-center font-semibold text-white">{message}</div>;
}

/** שומר ערך טופס מקומי שמתאפס כשהמקור משתנה (למשל מעבר ליום אחר). */
export function useDraft<T>(source: T): [T, (next: T) => void] {
  const [draft, setDraft] = useState(source);
  useEffect(() => setDraft(source), [source]);
  return [draft, setDraft];
}
