
// בדיקת פריסה אוטומטית: מה גולש מהכרטיס שלו, מה נחתך, ומה יוצא מהמסך
window.audit = (rootSel) => {
  const stage = document.querySelector('.stage').getBoundingClientRect();
  const root = document.querySelector(rootSel);
  const out = [];
  const name = el => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName) + (el.querySelector?.('.label') ? ' [' + el.querySelector('.label').textContent.trim().slice(0, 18) + ']' : '');
  const tol = 3;
  root.querySelectorAll('.card, .wd, .frame, .polaroid, .win, .head, .wallwx').forEach(box => {
    const b = box.getBoundingClientRect();
    if (!b.width) return;
    if (b.left < stage.left - tol || b.right > stage.right + tol || b.top < stage.top - tol || b.bottom > stage.bottom + tol) out.push('OUT-OF-STAGE ' + name(box));
    if (box.classList.contains('evs')) return;
    for (const el of box.querySelectorAll('b, small, span, .li, .row, .task, .meal, .ev, .wx-temp, .clock, .date')) {
      if (el.closest('.evs') || el.closest('.skybox') || el.closest('.photo')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const over = Math.max(b.left - r.left, r.right - b.right, b.top - r.top, r.bottom - b.bottom);
      if (over > tol + 4) { out.push(`SPILL ${Math.round(over)}px ${name(box)} <- "${el.textContent.trim().slice(0, 24)}"`); break; }
    }
  });
  root.querySelectorAll('.col').forEach((col, i) => { if (col.scrollHeight > col.clientHeight + tol) out.push(`COLUMN ${i} overflow ${col.scrollHeight - col.clientHeight}px`); });
  root.querySelectorAll('.card').forEach(card => { if (getComputedStyle(card).overflow === 'hidden' && card.scrollHeight > card.clientHeight + tol) out.push(`CLIPPED ${card.scrollHeight - card.clientHeight}px ${name(card)}`); });
  root.querySelectorAll('b, small, .date, .bdl, .wx-meta, .ev').forEach(el => { if (el.closest('.evs-in') && !el.classList.contains('ev')) return; if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === 'hidden') out.push(`TRUNCATED "${el.textContent.trim().slice(0, 30)}"`); });
  const sizes = {};
  root.querySelectorAll('.frame, .polaroid .pic, .win').forEach(el => { const r = el.getBoundingClientRect(); sizes[name(el)] = Math.round(r.width / (stage.width / 100)) + 'u x ' + Math.round(r.height / (stage.width / 100)) + 'u'; });
  return { issues: [...new Set(out)], sizes };
};
