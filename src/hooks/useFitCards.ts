import { useLayoutEffect, useRef } from 'react';

/**
 * שומר שכרטיסי הילדים לא יגלשו מתחת לשורה התחתונה: מודד כל כרטיס מול הגובה הפנוי,
 * ומקטין את הכתב של התוכן שלו (האלמנט ‎.kid-in) עד שהוא נכנס. כך רשימה ארוכה,
 * או שורה שנשברת לשתיים, לא עולות על מה שמתחתיהן.
 */
export function useFitCards() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const fit = () => {
      const room = box.clientHeight;
      for (const card of Array.from(box.children) as HTMLElement[]) {
        const inner = card.querySelector<HTMLElement>('.kid-in');
        if (!inner) continue;
        inner.style.fontSize = '';
        let scale = 1;
        // הריפוד של הכרטיס לא מתכווץ עם הכתב, לכן כמה סבבים עד שמתייצב
        for (let i = 0; i < 5 && room > 0 && card.offsetHeight > room; i++) {
          scale *= (room / card.offsetHeight) * 0.99;
          inner.style.fontSize = `${scale}em`;
        }
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    let alive = true;
    document.fonts?.ready.then(() => alive && fit());
    return () => { alive = false; observer.disconnect(); };
  });
  return ref;
}
